# NetViz

Interactive network packet flow visualizer for ITC 583 (Cloud Computing).

I built a Spring Boot web app where you can design a simple network on a canvas, set link speeds and traffic, and watch packets move with color-coded utilization (green / yellow / red).

## Stack

- Java 17 + Spring Boot 3.3
- Thymeleaf + HTML5 Canvas + plain JavaScript
- H2 file database for saving topologies
- Maven build

## Run locally

```bash
mvn spring-boot:run
```

Then open http://localhost:8081/

Or:

```bash
mvn -DskipTests package
java -jar target/netviz-1.0.0.jar
```

## Deploy on the class VM

The app uses port **8081** (8080 was already used by another assignment).

```bash
mvn -DskipTests package
cp target/netviz-1.0.0.jar netviz.jar
mkdir -p logs data
nohup java -jar netviz.jar --server.port=8081 > logs/app.log 2>&1 &
```

You can also use `./start.sh` or `./deploy.sh` if you set `DEPLOY_HOST`.

## API

- `GET /api/health`
- `GET /api/topologies`
- `GET /api/topologies/{id}`
- `POST /api/topologies`
- `PUT /api/topologies/{id}`
- `DELETE /api/topologies/{id}`

## CI

GitHub Actions (`.github/workflows/ci.yml`) builds the JAR on push and pull requests.

## Notes

- Demo topology loads on the home page. Press Play to animate packets.
- Shift+click one device, then another, to draw a link.
- Double-click a link to edit bandwidth and traffic.

Josiah Gilbert — ITC 583, Summer 2026
