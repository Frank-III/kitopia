import { server } from "kitopia";

const app = server();

app.get("/", ({ res }) => {
  res.send("hello world!");
});

app.listen(3000);
