Restart the development servers:

1. Stop: find and kill processes on port 8080 (backend) and port 3000 (frontend) using `lsof -ti:<port>`
2. Start: run `npm run dev --prefix backend` in the background
3. Start: run `npm run dev --prefix frontend` in the background
4. Verify backend is running by curling http://localhost:8080/api/ping
5. Confirm frontend is running on http://localhost:3000
