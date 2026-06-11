const MovieModel = require('./models/movieModel');

(async () => {
  try {
    const movies = await MovieModel.getNowShowing();
    console.log(JSON.stringify(movies, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
})();
