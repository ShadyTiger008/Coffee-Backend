import dotenv from 'dotenv';
import connectDb from './db/index.js';
import { app } from './app.js';

dotenv.config({
    path: './.env'
})

connectDb()
  .then(() => {
    app.listen(process.env.PORT || 8001, (req, res) => {
      console.log(`⚙️  Server listening on ${process.env.PORT}.....`);
    });
  })
  .catch((error) => {
    console.log(`Error listening on ${process.env.PORT}`, error);
  });