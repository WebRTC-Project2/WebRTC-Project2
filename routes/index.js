var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});
router.post('/upload-song', (req, res) => {
  try {
    if (!req.files) {
      res.send({
        status: false,
        message: 'No file uploaded'
      });
    } else {
      let song = req.files.song;

      song.mv('./public/songs/' + song.name);

      res.send({
        status: true,
        message: 'File is uploaded',
        data: {
          name: song.name,
          mimetype: song.mimetype,
          size: song.size
        }
      });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});
module.exports = router;
