'use strict';

//variable '$self' is used for things on users side of call
//initially starts by setting audio to off and video to on
let broadcast_song_status = false;
let broadcast_song_volume = false;

const $self = {
  rtcConfig:
  {
    iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }]
  },
  mediaConstraints:
  {
    audio: false,
    video: true
  }
};

//peers object is used as users other than $self in syscal
//sets up a connection b/w two or more ($self & $peers)
const $peers = {
  connection: new RTCPeerConnection($self.rtcConfig)
};

// Ask permission to use video or audio
requestUserMedia($self.mediaConstraints);

//requests media usage from user in pop up
async function requestUserMedia(media_constraints)
{
  $self.stream = new MediaStream();
  $self.media = await navigator.mediaDevices
    .getUserMedia(media_constraints);
  $self.stream.addTrack($self.media.getTracks()[0]);
  displayStream('#self', $self.stream);
}

/**
 *  Socket Server Events and Callbacks
 */

//namespace to use hash in window
const namespace = prepareNamespace(window.location.hash, true);

//pass in namespace for particular hash
const sc = io(`/${namespace}`,
{
  autoConnect: false
});

registerScEvents();

/* DOM Elements */

const filesForm = document.querySelector('#files-form');

filesForm.addEventListener('submit', handleFilesForm);

const button = document
  .querySelector('#call-button');

button.addEventListener('click',
  handleButton);

const selfVideo = document
  .querySelector('#self');

const chatForm = document
  .querySelector('#chat-form');

const vidButton = document
  .querySelector('#video-button');

vidButton.addEventListener('click',
  stopVid);

const userNamebtn = document
  .querySelector('#username-form');

userNamebtn.addEventListener('submit',
  handleUsernameForm);

function handleUsernameForm()
{
  event.preventDefault();
  const form = event.target;
  const username = form.querySelector('#username-input').value;
  const figcaption = document.querySelector('#self figcaption');
  figcaption.innerText = username;
  $self.username = username;
  for (let id in $peers)
  {
    shareUsername(username, id);
  }
}

function handleFilesForm(event)
{
  event.preventDefault();
  const form = event.target;
  const fileInput = form.querySelector('#files-input');
  const file = fileInput.files[0];
  console.log('Got a file with the name', file.name);
  //peer = $peers[id]
  sendFile($peer, file);
}

function sendFile(peer, file)
{
  // create a package of file metadata
  const metadata = {
    name: file.name,
    size: file.size,
    type: file.type
  };
  const chunk = 8 * 1024; // 8KiB (kibibyte)
  // console.log(JSON.stringify(metadata));

  // create an asymmetric data channel
  const fdc = peer.connection
    .createDataChannel(`file-${metadata.name}`);

  if (!peer.features ||
    ($self.features.binaryType !== peer.features.binaryType)
  )
  {
    fdc.binaryType = 'arraybuffer';
  }
  console.log(`Lets use the ${fdc.binaryType} data type!`);

  fdc.onopen = async function ()
  {
    // send the metadata, once the data channel opens
    console.log('Created a data channel with ID', fdc.id);
    console.log('Heard datachannel open event.')
    console.log('Use chunk size', chunk);
    fdc.send(JSON.stringify(metadata));

    // send the actual file data
    let data =
      fdc.binaryType === 'blob' ? file : await file.arrayBuffer();
    console.log(metadata.size);
    for (let i = 0; i < metadata.size; i += chunk)
    {
      console.log('Attempting to send a chunk of data...');
      fdc.send(data.slice(i, i + chunk));
    }

  };
  fdc.onmessage = function (
  {
    data
  })
  {
    // handle an acknowledgement from the receiving peer
    let message = JSON.parse(data);
    console.log('Successfully sent file', message.name);
    console.log('Closing the data channel');
    fdc.close();
  }
}

function receivedFile(fdc)
{
  const chunk = [];
  let receivedBytes = 0;
  let metadata;
  fdc.onmessage = function (
  {
    data
  })
  {
    let message = data;
    if (typeof (message) === 'string' && message.startsWith('{'))
    {
      metadata = JSON.parse(message);
      console.log(`received metadata ${message}`)
    }
    else
    {
      console.log('Received file data')
      chunk.push(data);
      receivedBytes += data.size ? data.size : data.byteLength;
      console.log('Received bytes so far', receivedBytes);
    }
    if (receivedBytes === metadata.size)
    {
      console.log('File transfer complete');
    }
  }

}

const audbutton = document
  .querySelector('#audio-button');

audbutton.addEventListener('click',
  stopAud);

/* User-Media/DOM */

function createVideoElement(id)
{
  const figure = document.createElement('figure');
  const figcaption = document.createElement('figcaption');
  const video = document.createElement('video');
  const video_attrs = {
    'autoplay': '',
    'playsinline': '',
  };

  figure.id = `peer-${id}`;
  figcaption.innerText = id;
  for (let attr in video_attrs)
  {
    video.setAttribute(attr, video_attrs[attr]);
  }
  figure.appendChild(video);
  figure.appendChild(figcaption);
  return figure;
}

/* DOM media events (grab self and peers)*/
function displayStream(selector, stream)
{
  let video_element = document.querySelector(selector);
  if (!video_element)
  {
    let id = selector.split('#peer-')[1]; // #peer-abc123
    video_element = createVideoElement(id);
  }
  let video = video_element.querySelector('video');
  video.srcObject = stream;
  document.querySelector('#videos').appendChild(video_element);
}

/* DOM Events */
//function for Audio on and off button
function stopAud(e)
{

  const audSt = $self.stream.getAudioTracks()[0];
  const audbutton = e.target;
  if (audbutton.className === 'audiocut')
  {
    audbutton.className = 'mute';
    audbutton.innerText = 'UnMute';
    audSt.enabled = false;
    console.log('Audio Stopped');
  }
  else
  {
    audbutton.className = 'audiocut';
    audbutton.innerText = 'Mute';
    audSt.enabled = true;
    console.log('Audio Started');
  }
}

//function for the vido on and off button
function stopVid(e)
{

  const vidSt = $self.stream.getVideoTracks()[0];
  const vidButton = e.target;
  if (vidButton.className === 'videocut')
  {
    vidButton.className = 'vidOff';
    vidButton.innerText = 'Video On';
    vidSt.enabled = false;
    console.log('Video Stopped');
  }
  else
  {
    vidButton.className = 'videocut';
    vidButton.innerText = 'Video Off';
    vidSt.enabled = true;
    console.log('Video Started');
  }
}

//adding eventlistener with the function in it to pause the video

//function for join and leave call
function handleButton(event)
{
  const callButton = event.target;
  if (callButton.className === 'join')
  {
    console.log('Joining the call...');
    callButton.className = 'leave';
    callButton.innerText = 'Leave Call';
    joinCall();
  }
  else
  {
    console.log('Leaving the call...');
    callButton.className = 'join';
    callButton.innerText = 'Join Call';
    leaveCall();
  }
}

// function that joins the call
function joinCall()
{
  sc.open();
}

// function that leaves the call
function leaveCall()
{
  sc.close();
  for (let id in $peers)
  {
    resetCall(id, true);
  }
}

// functions that resets the connection

function setSelfAndPeerById(id, politeness)
{
  $self[id] = {
    isPolite: politeness,
    isMakingOffer: false,
    isIgnoringOffer: false,
    isSettingRemoteAnswerPending: false
  };
  $peers[id] = {
    connection: new RTCPeerConnection($self.rtcConfig)
  }
}

function resetCall(id, disconnect)
{
  const peer = $peers[id];
  const videoSelector = `#peer-${id}`;
  displayStream(videoSelector, null);
  peer.connection.close();
  if (disconnect)
  {
    document.querySelector(videoSelector).remove();
    delete $self[id];
    delete $peers[id];
  }
}

// function that resets the connection and establishes it again

function resetAndConnectAgain(id)
{
  const isPolite = $self[id].isPolite;
  resetCall(id, false);
  setSelfAndPeerById(id, isPolite);
  $self[id].isSuppressingInitialOffer = isPolite;

  establishCallFeatures(id);

  if (isPolite)
  {
    sc.emit('signal',
    {
      to: id,
      from: $self.id,
      signal:
      {
        description:
        {
          type: '_reset'
        }
      }
    });
  }
}

//function to show messages
function appendMessage(sender, message)
{
  const log = document.querySelector('#chat-log');
  const li = document.createElement('li');
  li.innerText = message;
  li.className = sender;
  log.appendChild(li);
}

/* WebRTC Events*/

function shareUsername(username, id)
{
  const peer = $peers[id];
  const userNameDC = peer.connection.createDataChannel(`username-${username}`);
}

//function that handles all the connection
function establishCallFeatures(id)
{
  registerRtcEvents(id);
  addStreamingMedia(id, $self.stream);
  if ($self.username)
  {
    shareUsername($self.username, id);
  }
}

function addStreamingMedia(id, stream)
{
  const peer = $peers[id];

  if (stream)
  {
    for (let track of stream.getTracks())
    {
      peer.connection.addTrack(track, stream);
    }
  }

  peer.chatChannel = peer.connection
    .createDataChannel('chat',
    {
      negotiated: true,
      id: 25
    });

  peer.chatChannel.onmessage = function (
  {
    data
  })
  {
    appendMessage('peer', data);

  }
}

function registerRtcEvents(id)
{
  const peer = $peers[id];
  peer.connection
    .onconnectionstatechange = handleRtcStateChange(id);
  peer.connection
    .onnegotiationneeded = handleRtcNegotiation(id);
  peer.connection
    .onicecandidate = handleIceCandidate(id);
  peer.connection
    .ontrack = handleRtcTrack(id);
  peer.connection
    .ondatachannel = handleRtcDataChannel(id);
}

function handleRtcNegotiation(id)
{
  return async function ()
  {
    const peer = $peers[id];
    if ($self[id].isSuppressingInitialOffer) return;
    try
    {
      // SDP description send and then set to make an offer false
      $self[id].isMakingOffer = true;
      await peer.connection.setLocalDescription();
    }
    catch (e)
    {
      const offer = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(offer);
    }
    finally
    {
      sc.emit('signal',
      {
        to: id,
        from: $self.id,
        signal:
        {
          description: peer.connection.localDescription
        }
      });
      $self[id].isMakingOffer = false;
    }
  }
}

function handleIceCandidate(id)
{
  return function (
  {
    candidate
  })
  {
    console.log('MY ICE CANDIDATE', candidate);
    sc.emit('signal',
    {
      to: id,
      from: $self.id,
      signal:
      {
        candidate: candidate
      }
    });
  }
}

function handleRtcStateChange(id)
{
  return function ()
  {
    const connectionState = $peers[id].connection.connectionState;
    document.querySelector(`#peer-${id}`).className = connectionState;
  }
}

function handleRtcTrack(id)
{
  return function (
  {
    track,
    streams: [stream]
  })
  {
    console.log('Attempt to display media from peer...');
    //send incoming track to peer
    displayStream(`#peer-${id}`, stream);
  }
}

function handleRtcDataChannel(id)
{
  return function (
  {
    channel
  })
  {
    const label = channel.label;
    console.log(`Data channel added for ${label}`);
    if (label.startsWith('username-'))
    {
      document.querySelector(`#peer-${id} figcaption`)
        .innerText = label.split('username-')[1];
      channel.onopen = function ()
      {
        channel.close();
      };
    }
  }
}

/*  Signaling Channel Events */

function registerScEvents()
{
  sc.on('connect', handleScConnect);
  sc.on('connected peer', handleScConnectedPeer);
  sc.on('connected peers', handleScConnectedPeers);
  sc.on('disconnected peer', handleScDisconnectedPeer);
  sc.on('signal', handleScSignal);
  sc.on('song received', handleSongReceive);
  sc.on('song status received', handleSongStatusReceive);
  sc.on('song volume received', handleSongVolumeReceive);
}

function handleSongVolumeReceive(data)
{
  console.log("song volume received");
  if (data.namespace == namespace)
  {
    const player = document.getElementById("player");
    player.volume = data.volume;
  }
}

function handleSongStatusReceive(data)
{
  console.log("song status received");
  const player = document.getElementById("player");
  if (data.namespace == namespace)
  {
    if (data.status == "paused")
    {
      player.pause();
    }
    if (data.status == "played")
    {
      player.play();
    }
  }
}

function handleSongReceive(data)
{
  console.log("song received");
  if (data.namespace == namespace)
  {
    playingId = data.playingId;
    playList = data.playList;
    playSongById();
  }
}

function handleScConnect()
{
  console.log('Successfully connected to the signaling server!');
  $self.id = sc.id;
}

var globe_ids;

function handleScConnectedPeers(ids)
{
  globe_ids = ids;
  console.log("GlobeIDs is ", globe_ids);
  console.log('Received already-connected peer IDs', ids.join(', '));
  for (let id of ids)
  {
    if (id !== $self.id)
    {
      setSelfAndPeerById(id, true);
      establishCallFeatures(id);
    }
  }
}

chatForm.addEventListener('submit',
  chatFormFun);
// function to handle chat messages
function chatFormFun(e)
{
  e.preventDefault();
  //const peer = $peers[id];
  const form = e.target;
  const userInput = document.querySelector('#chat-msg');
  const message = userInput.value;
  appendMessage('self', message);
  console.log("globe_ids:", globe_ids);
  //console.log("Contents of ids variable", globe_ids);
  console.log("Type of ids variable is", typeof (globe_ids));
  let peer;
  for (let id1 of globe_ids)
  {
    peer = $peers[id1];
    //console.log("Value of apeer is given below");
    //console.log(apeer);
    peer.chatChannel.send(message);
  }

  console.log('customer message ', message);
  userInput.value = '';

}

function handleScConnectedPeer(id)
{
  console.log('Heard new connected peer ID:', id);
  setSelfAndPeerById(id, false);
  establishCallFeatures(id);
  globe_ids.push(id);
  console.log("id is:", id);
  console.log("peer of that is", $peers[id]);
}

function handleScDisconnectedPeer(id)
{
  console.log('Heard disconnected peer event!');
  console.log('Disconnected peer ID:', id);

  resetCall(id, true);
}

async function handleScSignal(
{
  from,
  signal:
  {
    description,
    candidate
  }
})
{
  const id = from;
  const peer = $peers[id];
  if (description)
  {

    if (description.type === '_reset')
    {
      resetAndConnectAgain(id);
      return;
    }

    const readyForOffer = !$self[id].isMakingOffer &&
      (peer.connection.signalingState === 'stable' ||
        $self[id].isSettingRemoteAnswerPending);

    const offerCollision = description.type === 'offer' && !readyForOffer;

    $self[id].isIgnoringOffer = !$self[id].isPolite && offerCollision;

    if ($self[id].isIgnoringOffer)
    {
      return;
    }

    $self[id].isSettingRemoteAnswerPending = description.type === 'answer';
    try
    {
      console.log('Signaling state on incoming description:',
        peer.connection.signalingState);
      await peer.connection.setRemoteDescription(description);
    }
    catch (e)
    {
      resetAndConnectAgain(id);
      return;
    }
    $self[id].isSettingRemoteAnswerPending = false;

    if (description.type === 'offer')
    {
      try
      {
        await peer.connection.setLocalDescription();
      }
      catch (e)
      {
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
      }
      finally
      {
        sc.emit('signal',
        {
          to: id,
          from: $self.id,
          signal:
          {
            description: peer.connection.localDescription
          }
        });
        $self[id].isSuppressingInitialOffer = false;
      }
    }
  }
  else if (candidate)
  {
    // This try & catch block is used for old browsers that don't know
    //what to do if they receive an ICE candidate.
    try
    {
      console.log(`INCOMING ICE CANDIDATE for ${id}`, candidate);
      await peer.connection.addIceCandidate(candidate);
    }
    catch (e)
    {
      // Log error unless $self[id] is ignoring offers
      // and candidate is not an empty string
      if (!$self[id].isIgnoringOffer && candidate.candidate.length > 1)
      {
        console.error('Unable to add ICE candidate for peer:', e);
      }
    } //end of catch
  }
}

/**
 *  Utility Functions
 */

function prepareNamespace(hash, set_location)
{
  let ns = hash.replace(/^#/, ''); // remove # from the hash
  if (/^[0-9]{6}$/.test(ns))
  {
    console.log('Checked existing namespace', ns);
    return ns;
  }
  ns = Math.random().toString().substring(2, 8);
  console.log('Created new namespace', ns);
  if (set_location) window.location.hash = ns;
  return ns;
}

function showAudioPlayer(url)
{
  let node = document.getElementById("audio-player");
  node.style.display = "block";
  let player = document.getElementById("player");
  player.src = url;
}
async function uploadSong(e)
{
  e.preventDefault();
  let song = document.getElementById("song").files[0];
  let res = await uploadFile(song);
  if (res.status == true)
  {
    let song_url = `/songs/${res.data.name}`;
    playingId = playList.length
    addToPlaylist(
    {
      id: playingId,
      name: res.data.name,
      song_url
    });
    broadcastSongChanges();
  }
  else
  {
    alert("can not send this song, try again");
  }

  return false;
}

const uploadFile = async(file) =>
{

  const fd = new FormData();
  fd.append('song', file);
  let res = await fetch('/upload-song',
  {
    method: 'POST',
    body: fd
  });
  return await res.json();
};

function onPlay(player)
{
  console.log("song played");
  if (broadcast_song_status)
  {
    sendSongStatus("played");
  }
}

function onPause(player)
{
  console.log("song paused");
  if (broadcast_song_status)
  {
    sendSongStatus("paused");
  }
}

function sendSongStatus(status)
{
  if (sc.connected)
  {
    console.log("sending the song status", status);
    sc.emit('songstatus',
    {
      status: status,
      namespace: namespace
    });
  }
  broadcast_song_status = false;
}

function onVChange(e)
{
  if (broadcast_song_volume)
  {
    if (sc.connected)
    {
      let vol = e.srcElement.volume;
      if (e.srcElement.muted)
      {
        vol = 0;
      }
      console.log("sending the song volume", vol);
      sc.emit('songvolume',
      {
        volume: vol,
        namespace: namespace
      });
    }
  }
  broadcast_song_volume = false;
}

function addToPlaylist(obj)
{
  playList.push(obj);
  playSongById();
}

function playSongById()
{
  console.log(playList);
  console.log(playingId);
  if (playList.length > 1)
  {
    document.getElementById("prevNextControls").style.display = "block";
  }
  let latest_song = playList[playingId];
  showAudioPlayer(latest_song.song_url);
  showPlaylist();
}

function showPlaylist()
{
  let pl = document.getElementById("playlist");
  let html = ``;
  for (let s of playList)
  {
    if (s.id == playingId)
    {
      html += `<li class="playing"> ${s.name}</li>`;
    }
    else
    {
      html += `<li class="stopped"> ${s.name}</li>`;
    }
  }
  pl.innerHTML = html;
}

function broadcastSongChanges()
{
  if (sc.connected)
  {
    console.log("sending the song url");
    sc.emit('uploadsong',
    {
      namespace: namespace,
      playList: playList,
      playingId: playingId
    });
  }
}

function playNext()
{
  playingId = playingId + 1;
  broadcastSongChanges();
  playSongById();
}

function playPrevious()
{
  playingId = playingId - 1;
  broadcastSongChanges();
  playSongById();
}
let playList = [];
let playingId = null;
