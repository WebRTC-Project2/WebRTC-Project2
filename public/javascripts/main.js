'use strict';

const $self = {
  rtcConfig: null,
  constraints: { audio: true, video: true},

};

const $peers = {
};

requestUserMedia($self.constraints);

async function requestUserMedia(constraints) {
  $self.stream = await navigator.mediaDevices
    .getUserMedia(constraints);
  displayStream('#self', $self.stream);
}


/**
* Socket Server Events and Callbacks
*/
const namespace = prepareNamespace(window.location.hash, true);

const sc = io(`/${namespace}`, { autoConnect: false });

registerScEvents();


/* DOM Elements */



const button = document
  .querySelector('#call-button');

const selfVideo = document
  .querySelector('#self');

button.addEventListener('click', handleButton);


const chatForm = document
.querySelector('#chat-form');

chatForm.addEventListener('submit',
 chatFormFun);

 const vidButton = document
   .querySelector('#video-button');

vidButton.addEventListener('click',
 stopVid);


const audbutton = document
   .querySelector('#audio-button');

audbutton.addEventListener('click',
 stopAud);

/* User-Media/DOM */

function createVideoElement(id) {
  const figure = document.createElement('figure');
  const video = document.createElement('video');
  const video_attrs = {
    'autoplay': '',
    'playsinline': '',

  };
  figure.id = `peer-${id}`;
  for (let attr in video_attrs) {
    video.setAttribute(attr, video_attrs[attr]);
  }
  figure.appendChild(video);
  figure.appendChild(figcaption);
  return figure;
}

function displayStream(selector, stream) {
  let vid_elm = document.querySelector(selector);
  if (!vid_elm) {
    let id = selector.split('#peer-')[1];
    vid_elm = createVideoElement(id);
  }
  let video = vid_elm.querySelector('video');
  video.srcObject = stream;
  document.querySelector('#videos').appendChild(vid_elm);
}


/* DOM Events */
//function for Audio on and off button
function stopAud(e){

  const audSt = $self.stream.getAudioTracks()[0];
  const audbutton = e.target;
  if (audbutton.className === 'audiocut') {
    audbutton.className = 'mute';
    audbutton.innerText = 'UnMute';
    audSt.enabled = false;
    console.log('Audio Stopped');
  } else {
    audbutton.className = 'audiocut';
    audbutton.innerText = 'Mute';
    audSt.enabled = true;
    console.log('Audio Started');
  }

}
//function for the vido on and off button
function stopVid(e) {

  const vidSt = $self.stream.getVideoTracks()[0];
  const vidButton = e.target;
  if (vidButton.className === 'videocut') {
    vidButton.className = 'vidOff';
    vidButton.innerText = 'Video ON';
    vidSt.enabled = false;
      console.log('Video Stopped');
  } else {
    vidButton.className = 'videocut';
    vidButton.innerText = 'Video Off';
    vidSt.enabled = true;
      console.log('Video Started');
  }
}

//adding eventlistener with the function in it to pause the video


//function for join and leave call
function handleButton(e) {
  const button = e.target;
  if (button.className === 'join') {
    button.className = 'leave';
    button.innerText = 'Leave Call';
    joinCall();
  } else {
    button.className = 'join';
    button.innerText = 'Join Call';
    leaveCall();
  }
}


// function that joins the call
function joinCall() {
  sc.open();

}

// function that joins the call

function leaveCall() {
  sc.close();
  for (let id in $peers) {
    resetCall(id, true);
  }
}
// functions that resets the connection

function setSelfAndPeerById(id, politeness) {
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


function resetCall(id, disconnect) {
  const peer = $peers[id];
  const videoSelector = `#peer-${id}`;
  displayStream(videoSelector, null);
  peer.connection.close();
  if (disconnect) {
    document.querySelector(videoSelector).remove();
    delete $self[id];
    delete $peers[id];
  }
}
// function that resets the connection and establishes it again

function resetAndConnectAgain(id) {
  const isPolite = $self[id].isPolite;
  resetCall(id, false);
  initializeSelfAndPeerById(id, isPolite);
  $self[id].isSuppressingInitialOffer = isPolite;

  establishCallFeatures(id);

  if (isPolite) {
    sc.emit('signal', { to: id, from: $self.id,
      signal: { description: { type: '_reset' } } });
  }
}


// function to handle chat messages
function chatFormFun(e) {
  e.preventDefault();

  const form = e.target;
  const userInput = document.querySelector('#chat-msg');
  const message = userInput.value;

  appendMessage('self', message);

  $peer.chatChannel.send(message);

  console.log ('customer message ', message);
  userInput.value = '';

}
//function to show messages
function appendMessage (sender, message){
  const log = document.querySelector('#chat-log');
  const li = document.createElement('li');
  li.innerText = message;
  li.className = sender;
  log.appendChild(li);

}

/* WebRTC Events */

//function that handles all the connection
function establishCallFeatures(id) {

  registerRtcEvents(id);
  addStreamingMedia(id, $self.stream);

  // //vdieo track
  //   peer.connection
  //     .addTrack($self.stream.getTracks()[0],
  //       $self.stream);
  // //audio track
  //   peer.connection
  //     .addTrack($self.stream.getTracks()[1],
  //       $self.stream);
  //
  //   peer.chatChannel = peer.connection
  //     .createDataChannel('chat',
  //       { negotiated: true, id: 25});
  //
  //   peer.chatChannel.onmessage = function({ data }){
  //     appendMessage('peer', data);
  //
  //   }
  // }


}

function addStreamingMedia(id, stream) {
  const peer = $peers[id];
  if (stream) {
    for (let track of stream.getTracks()) {
      peer.connection.addTrack(track, stream);
    }
  }
}


function registerRtcEvents(id) {
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


async function handleRtcNegotiation(id) {
  return async function() {
    const peer = $peers[id];
    if ($self[id].isSuppressingInitialOffer) return;
    try {
      $self[id].isMakingOffer = true;
      await peer.connection.setLocalDescription();
    } catch(e) {
      const offer = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(offer);
    } finally {
      sc.emit('signal',
        { to: id, from: $self.id,
          signal: { description: peer.connection.localDescription } });
      $self[id].isMakingOffer = false;
    }
  }
}
function handleIceCandidate( id ) {
  return function({ candidate }) {
    console.log('MY ICE CANDIDATE', candidate);
    sc.emit('signal', { to: id, from: $self.id,
      signal: { candidate: candidate } });
  }
}
function handleRtcStateChange(id) {
  return function() {
    const connectionState = $peers[id].connection.connectionState;
    document.querySelector(`#peer-${id}`).className = connectionState;
  }
}
function handleRtcTrack(id) {
  return function({ track, streams: [stream] }) {
    console.log('Attempt to display media from peer...');
    displayStream(`#peer-${id}`, stream);
  }
}

function handleRtcDataChannel(id) {
  return function({ channel }) {
    const label = channel.label;
    console.log(`Data channel added for ${label}`);
    if (label.startsWith('username-')) {
      document.querySelector(`#peer-${id} figcaption`)
        .innerText = label.split('username-')[1];
      channel.onopen = function() {
        channel.close();
      };
    }
  }
}

/* Signaling Channel Events */

function registerScEvents() {
  sc.on('connect', handleScConnect);
  sc.on('connected peer', handleScConnectedPeer);
  sc.on('connected peers', handleScConnectedPeers);
  sc.on('signal', handleScSignal);
  sc.on('disconnected peer', handleScDisconnectedPeer)
}


function handleScConnect() {
  console.log('Connected to signaling channel!');
  $self.id = sc.id;
  console.log('Self ID:', $self.id);
}

function handleScConnectedPeers(ids) {
  console.log('Already-connected peer IDs', ids.join(', '));
  for (let id of ids) {
    if (id !== $self.id) {
      initializeSelfAndPeerById(id, true);
      establishCallFeatures(id);
    }
  }
}

function handleScConnectedPeer(id) {
  console.log('Connected peer ID:', id);
  setSelfAndPeerById(id, false);
  establishCallFeatures(id);
}


function handleScDisconnectedPeer(id) {
  console.log('Heard disconnected peer event!');
  console.log('Disconnected peer ID:', id);

}

async function handleScSignal({ from, signal: {description, candidate } }) {
  const id = from;
  const peer = $peers[id];
  console.log('Heard signal event!');
  if (description) {
    console.log('Received SDP Signal:', description);

  if (description.type === '_reset'){
    resetAndConnectAgain(id);
    return;
  }
    const readyForOffer =
        !$self[id].isMakingOffer &&
        ($peer.connection.signalingState === 'stable'
          || $self[id].isSettingRemoteAnswerPending);

    const offerCollision = description.type === 'offer' && !readyForOffer;

    $self[id].isIgnoringOffer = !$self[id].isPolite && offerCollision;

    if ($self[id].isIgnoringOffer) {
      return;
    }

    $self[id].isSettingRemoteAnswerPending = description.type === 'answer';
    console.log('Incoming info:',
         peer.connection.signalingState);
       try {
         await peer.connection.setRemoteDescription(description);
       } catch(e) {

         resetAndConnectAgain(id);
         return;
       }
    $self[id].isSettingRemoteAnswerPending = false;

    if (description.type === 'offer') {
      try {
        await peer.connection.setLocalDescription(); // running with new options
      } catch(e){
        const response = await peer.connection.createResponse();//running with older options
        await peer.connection.setLocalDescription(response);
      } finally{
        sc.emit('signal', { to: id, from: $self.id, signal:
          { description: peer.connection.localDescription } });
        $self[id].isSuppressingInitialOffer = false;
      }
    }
  } else if (candidate) {
    console.log('Received ICE candidate:', candidate);
    try {
      await peer.connection.addIceCandidate(candidate);
    } catch(e) {
      if (!$self[id].isIgnoringOffer) {
        console.error('Cannot add ICE candidate for peer', e);
      }
    }
  }
}

/**
 *  Utility Functions
 */
function prepareNamespace(hash, set_location) {
  let ns = hash.replace(/^#/, ''); // remove # from the hash
  if (/^[0-9]{6}$/.test(ns)) {
    console.log('Checked existing namespace', ns);
    return ns;
  }
  ns = Math.random().toString().substring(2, 8);
  console.log('Created new namespace', ns);
  if (set_location) window.location.hash = ns;
  return ns;
}
