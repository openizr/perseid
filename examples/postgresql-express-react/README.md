# postgresql-express-react

Example of a full-stack web app running on Perseid, using [PostgreSQL](https://www.postgresql.org/), [ExpressJS](https://expressjs.com/) and [React](https://reactjs.org/).


## Usage

/!\ [docker-compose](https://docs.docker.com/compose/) is required on your machine to run this example /!\

1. `cp .env.example .env`
2. Change environment variables values in `.env` file according to your needs
3. `docker-compose up`
4. `docker exec <PROJECT_NAME>_postgresql psql -c "CREATE DATABASE test WITH ENCODING = 'UTF8' LC_COLLATE 'en_US.utf8';"`
5. `docker exec <PROJECT_NAME>_postgresql psql -c "CREATE DATABASE jobs WITH ENCODING = 'UTF8' LC_COLLATE 'en_US.utf8';"`

## License

[MIT](http://opensource.org/licenses/MIT)

Copyright (c) Openizr. All Rights Reserved.
