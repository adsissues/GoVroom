import {onRequest} from "firebase-functions/https";

export const helloWorld = onRequest((req, res) => {
  res.send("Hello World!");
});
