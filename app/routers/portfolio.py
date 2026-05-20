from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterable, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models import PortfolioTransaction, Stock, User
from app.schemas import PortfolioPositionRead, PortfolioTransactionCreate, PortfolioTransactionRead
from app.services.stock_data import async_get_realtime_quote

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


@dataclass
class PositionState:
    stock: Stock
    total_shares: Decimal = field(default_factory=lambda: Decimal("0"))
    total_cost: Decimal = field(default_factory=lambda: Decimal("0"))


@dataclass
class PendingTransaction:
    transaction_type: str
    shares: Decimal
    price: Decimal
    transaction_date: datetime
    id: int


def _apply_transaction(
    position: PositionState,
    transaction_type: str,
    shares: Decimal,
    price: Decimal,
    *,
    reject_oversell: bool = False,
) -> bool:
    if transaction_type == "buy":
        position.total_shares += shares
        position.total_cost += shares * price
        return True

    if shares > position.total_shares:
        if reject_oversell:
            return False
        position.total_shares = Decimal("0")
        position.total_cost = Decimal("0")
        return True

    avg_cost = position.total_cost / position.total_shares
    position.total_shares -= shares
    position.total_cost -= shares * avg_cost

    if position.total_shares == 0:
        position.total_cost = Decimal("0")

    return True


def _normalized_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _transaction_sort_key(tx: PortfolioTransaction | PendingTransaction) -> tuple[datetime, int]:
    return _normalized_datetime(tx.transaction_date), tx.id


def _calculate_position(stock: Stock, transactions: Iterable[PortfolioTransaction]) -> PositionState:
    position = PositionState(stock=stock)
    for tx in transactions:
        _apply_transaction(position, tx.transaction_type, tx.shares, tx.price)
    return position


def _calculate_positions(transactions: Iterable[PortfolioTransaction]) -> dict[int, PositionState]:
    positions: dict[int, PositionState] = {}
    for tx in transactions:
        if tx.stock_id not in positions:
            positions[tx.stock_id] = PositionState(stock=tx.stock)
        _apply_transaction(positions[tx.stock_id], tx.transaction_type, tx.shares, tx.price)
    return positions


def _get_user_transactions(
    db: Session,
    user_id: int,
    stock_id: Optional[int] = None,
) -> list[PortfolioTransaction]:
    query = db.query(PortfolioTransaction).filter(PortfolioTransaction.user_id == user_id)
    if stock_id is not None:
        query = query.filter(PortfolioTransaction.stock_id == stock_id)

    return query.order_by(
        PortfolioTransaction.transaction_date,
        PortfolioTransaction.id,
    ).all()


def _can_apply_pending_transaction(
    existing_transactions: Iterable[PortfolioTransaction],
    stock: Stock,
    pending: PendingTransaction,
) -> bool:
    position = PositionState(stock=stock)
    ordered_transactions = sorted(
        [*existing_transactions, pending],
        key=_transaction_sort_key,
    )
    for tx in ordered_transactions:
        if not _apply_transaction(
            position,
            tx.transaction_type,
            tx.shares,
            tx.price,
            reject_oversell=True,
        ):
            return False
    return True


@router.post("/transactions", response_model=PortfolioTransactionRead, status_code=status.HTTP_201_CREATED)
def create_transaction(
    data: PortfolioTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Record a buy or sell transaction."""
    stock = db.query(Stock).filter(Stock.symbol == data.symbol).first()
    if not stock:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stock {data.symbol} not found",
        )

    transaction_date = data.transaction_date or datetime.now(timezone.utc)

    if data.transaction_type == "sell":
        existing_transactions = _get_user_transactions(db, current_user.id, stock.id)
        pending = PendingTransaction(
            transaction_type=data.transaction_type,
            shares=data.shares,
            price=data.price,
            transaction_date=transaction_date,
            id=2**31 - 1,
        )
        if not _can_apply_pending_transaction(existing_transactions, stock, pending):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient shares to sell {data.shares} of {stock.symbol}",
            )

    tx = PortfolioTransaction(
        user_id=current_user.id,
        stock_id=stock.id,
        transaction_type=data.transaction_type,
        shares=data.shares,
        price=data.price,
        transaction_date=transaction_date,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    return PortfolioTransactionRead(
        id=tx.id,
        symbol=stock.symbol,
        transaction_type=tx.transaction_type,
        shares=tx.shares,
        price=tx.price,
        transaction_date=tx.transaction_date,
        created_at=tx.created_at,
    )


@router.get("/positions", response_model=List[PortfolioPositionRead])
async def get_positions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get current portfolio positions with P&L."""
    transactions = _get_user_transactions(db, current_user.id)
    positions = _calculate_positions(transactions)

    result = []
    for pos in positions.values():
        if pos.total_shares <= 0:
            continue

        stock = pos.stock
        avg_price = pos.total_cost / pos.total_shares
        quote = await async_get_realtime_quote(stock.symbol)
        current_price = Decimal(str(quote["price"])) if quote else None

        market_value = current_price * pos.total_shares if current_price else None
        unrealized = market_value - pos.total_cost if market_value else None
        unrealized_pct = (unrealized / pos.total_cost * Decimal("100")) if unrealized else None

        result.append(
            PortfolioPositionRead(
                symbol=stock.symbol,
                name=stock.name,
                shares=pos.total_shares,
                avg_price=avg_price,
                current_price=current_price,
                market_value=market_value,
                unrealized_pnl=unrealized,
                unrealized_pnl_percent=unrealized_pct,
            )
        )

    return result


@router.get("/positions/{symbol}", response_model=PortfolioPositionRead)
async def get_position(
    symbol: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get a single stock position."""
    stock = db.query(Stock).filter(Stock.symbol == symbol).first()
    if not stock:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stock {symbol} not found",
        )

    transactions = _get_user_transactions(db, current_user.id, stock.id)
    position = _calculate_position(stock, transactions)

    if position.total_shares <= 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No position found for {symbol}",
        )

    avg_price = position.total_cost / position.total_shares
    quote = await async_get_realtime_quote(stock.symbol)
    current_price = Decimal(str(quote["price"])) if quote else None
    market_value = current_price * position.total_shares if current_price else None
    unrealized = market_value - position.total_cost if market_value else None
    unrealized_pct = (unrealized / position.total_cost * Decimal("100")) if unrealized else None

    return PortfolioPositionRead(
        symbol=stock.symbol,
        name=stock.name,
        shares=position.total_shares,
        avg_price=avg_price,
        current_price=current_price,
        market_value=market_value,
        unrealized_pnl=unrealized,
        unrealized_pnl_percent=unrealized_pct,
    )
