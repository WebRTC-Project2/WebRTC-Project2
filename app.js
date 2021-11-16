const cookieParser = require('cookie-parser');
const express = require('express');
const io = require('socket.io')();
const logger = require('morgan');
const path = require('path');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

const namespaces = io.of(/^\/[0-9]{6}$/);

namespaces.on('connection', function(socket) {
  const namespace = socket.nsp;
  const multipeers = [];

  for (let i of namespace.sockets.keys()){
    multipeers.push(i);
  }

  //send id's of new connection to connecor
  socket.emit('connected peer',multipeers);

  //peer id to all connected peers
  socket.broadcast.emit('connected peer', socket.id);


  // listen for signals
  socket.on('signal', function({ to, from, signal }) {
    socket.to(to).emit('signal', { to, from, signal });
  });
  // listen for disconnects
  socket.on('disconnect', function() {
    namespace.emit('disconnected peer', socket.id);
  });

  //listen for song url update
 socket.on('uploadsong', function (data) {
   socket.broadcast.emit('song received', data);
 });

});

module.exports = { app, io };
