from datetime import datetime, timezone
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models import PortfolioTransaction, Stock, User
from app.schemas import PortfolioPositionRead, PortfolioTransactionCreate, PortfolioTransactionRead
from app.services.stock_data import async_get_realtime_quote

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


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

    tx = PortfolioTransaction(
        user_id=current_user.id,
        stock_id=stock.id,
        transaction_type=data.transaction_type,
        shares=data.shares,
        price=data.price,
        transaction_date=data.transaction_date or datetime.now(timezone.utc),
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
    transactions = (
        db.query(PortfolioTransaction)
        .filter(PortfolioTransaction.user_id == current_user.id)
        .order_by(PortfolioTransaction.transaction_date)
        .all()
    )

    # Aggregate by stock
    positions: dict[int, dict] = {}
    for tx in transactions:
        sid = tx.stock_id
        if sid not in positions:
            positions[sid] = {
                "stock": tx.stock,
                "total_shares": Decimal("0"),
                "total_cost": Decimal("0"),
            }
        if tx.transaction_type == "buy":
            positions[sid]["total_shares"] += tx.shares
            positions[sid]["total_cost"] += tx.shares * tx.price
        else:
            positions[sid]["total_shares"] -= tx.shares
            positions[sid]["total_cost"] -= tx.shares * tx.price

    result = []
    for sid, pos in positions.items():
        if pos["total_shares"] <= 0:
            continue

        stock = pos["stock"]
        avg_price = pos["total_cost"] / pos["total_shares"]
        quote = await async_get_realtime_quote(stock.symbol)
        current_price = Decimal(str(quote["price"])) if quote else None

        market_value = current_price * pos["total_shares"] if current_price else None
        unrealized = market_value - pos["total_cost"] if market_value else None
        unrealized_pct = (unrealized / pos["total_cost"] * Decimal("100")) if unrealized else None

        result.append(
            PortfolioPositionRead(
                symbol=stock.symbol,
                name=stock.name,
                shares=pos["total_shares"],
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

    transactions = (
        db.query(PortfolioTransaction)
        .filter(
            PortfolioTransaction.user_id == current_user.id,
            PortfolioTransaction.stock_id == stock.id,
        )
        .order_by(PortfolioTransaction.transaction_date)
        .all()
    )

    total_shares = Decimal("0")
    total_cost = Decimal("0")
    for tx in transactions:
        if tx.transaction_type == "buy":
            total_shares += tx.shares
            total_cost += tx.shares * tx.price
        else:
            total_shares -= tx.shares
            total_cost -= tx.shares * tx.price

    if total_shares <= 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No position found for {symbol}",
        )

    avg_price = total_cost / total_shares
    quote = await async_get_realtime_quote(stock.symbol)
    current_price = Decimal(str(quote["price"])) if quote else None
    market_value = current_price * total_shares if current_price else None
    unrealized = market_value - total_cost if market_value else None
    unrealized_pct = (unrealized / total_cost * Decimal("100")) if unrealized else None

    return PortfolioPositionRead(
        symbol=stock.symbol,
        name=stock.name,
        shares=total_shares,
        avg_price=avg_price,
        current_price=current_price,
        market_value=market_value,
        unrealized_pnl=unrealized,
        unrealized_pnl_percent=unrealized_pct,
    )
