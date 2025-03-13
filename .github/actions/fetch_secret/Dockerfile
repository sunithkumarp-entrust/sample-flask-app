FROM golang:1.24.1-alpine AS builder

WORKDIR /app

COPY go.mod ./
COPY main.go ./

RUN go build -o /vault-action

FROM alpine:3.14

COPY --from=builder /vault-action /vault-action

ENTRYPOINT ["/vault-action"]
