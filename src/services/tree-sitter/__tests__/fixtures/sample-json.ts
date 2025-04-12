export default String.raw`{
  "server": {
    "port": 3000,
    "host": "localhost",
    "ssl": {
      "enabled": true,
      "cert": "/path/to/cert.pem",
      "key": "/path/to/key.pem"
    }
  },
  "database": {
    "primary": {
      "host": "db.example.com",
      "port": 5432,
      "credentials": {
        "user": "admin",
        "password": "secret123",
        "roles": ["read", "write", "admin"]
      }
    }
  }
}`
