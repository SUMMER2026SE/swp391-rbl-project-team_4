require('dotenv').config();
const MovieModel = require('./models/movieModel');

async function run() {
  try {
    console.log('Calling MovieModel.getAllMovies...');
    const result = await MovieModel.getAllMovies({});
    console.log('MOVIES FOUND:', result.length);
    console.log(result.slice(0, 3));
    process.exit(0);
  } catch (err) {
    console.error('ERROR OCCURRED:', err);
    process.exit(1);
  }
}
run();
