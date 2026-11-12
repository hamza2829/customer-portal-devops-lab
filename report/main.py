import csv
import hmac
import io
import os
from typing import Annotated, Literal
from uuid import UUID

from fastapi import FastAPI, Header, HTTPException, Path
from fastapi.responses import Response
from pydantic import BaseModel, Field

app = FastAPI(title="Customer Portal Report Service")
Status = Literal["open", "shipped", "cancelled"]
MONTH_PATTERN = r"^([1-9][0-9]{3}|0[1-9][0-9]{2}|00[1-9][0-9]|000[1-9])-(0[1-9]|1[0-2])$"


class OrderLine(BaseModel):
    status: Status
    amountCents: Annotated[int, Field(strict=True, gt=0, le=100_000_000)]


class ReportInput(BaseModel):
    orders: list[OrderLine]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/reports/{customer_id}/{month}", response_model=None)
def monthly_report(
    customer_id: UUID,
    month: Annotated[str, Path(pattern=MONTH_PATTERN)],
    payload: ReportInput,
    format: Literal["json", "csv"] = "json",
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, str | int] | Response:
    expected = "Bearer " + os.getenv("REPORT_TOKEN", "lab-report-token")
    if not authorization or not hmac.compare_digest(authorization.encode(), expected.encode()):
        raise HTTPException(401, "Invalid service token", headers={"WWW-Authenticate": "Bearer"})

    summary = {
        "customerId": str(customer_id),
        "month": month,
        "orderCount": len(payload.orders),
        "openCount": sum(order.status == "open" for order in payload.orders),
        "shippedCount": sum(order.status == "shipped" for order in payload.orders),
        "cancelledCount": sum(order.status == "cancelled" for order in payload.orders),
        "totalAmountCents": sum(
            order.amountCents for order in payload.orders if order.status != "cancelled"
        ),
    }
    if format == "json":
        return summary

    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=list(summary))
    writer.writeheader()
    writer.writerow(summary)
    return Response(
        output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="orders-{month}.csv"'},
    )
