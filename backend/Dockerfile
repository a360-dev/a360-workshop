FROM cosmtrek/air:latest

WORKDIR /app

# No need to install air, it's already in the base image
COPY go.mod go.sum ./
RUN go mod download

COPY . .

CMD ["air", "-c", ".air.toml"]
