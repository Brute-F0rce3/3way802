var sTransferNumber;
var oRingTone, oRingbackTone;
var oSipStack, oSipSessionRegister, oSipSessionCall1, oSipSessionCall2;
var videoRemote1, videoRemote2, videoLocal, audioRemote;
var bFullScreen = false;
var oNotifICall;
var bDisableVideo = false;
var viewVideoLocal, viewVideoRemote1, viewVideoRemote2;
var oConfigCall;
var oReadyStateTimer;
var realmm = "ipc.johnsamuel.in";

window.onload = function () {
    window.console && window.console.info && window.console.info("location=" + window.location);

    videoLocal = document.getElementById("video_local");
    videoRemote1 = document.getElementById("video_remote1");
    videoRemote2 = document.getElementById("video_remote2");
    audioRemote = document.getElementById("audio_remote");


    document.onkeyup = onKeyUp;
    document.body.onkeyup = onKeyUp;

    var getPVal = function (PName) {
        var query = window.location.search.substring(1);
        var vars = query.split('&');
        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split('=');
            if (decodeURIComponent(pair[0]) === PName) {
                return decodeURIComponent(pair[1]);
            }
        }
        return null;
    }

    var preInit = function () {
        var s_webrtc_type = getPVal("wt");
        var s_fps = getPVal("fps");
        var s_mvs = getPVal("mvs"); // maxVideoSize
        var s_mbwu = getPVal("mbwu"); // maxBandwidthUp (kbps)
        var s_mbwd = getPVal("mbwd"); // maxBandwidthUp (kbps)
        var s_za = getPVal("za"); // ZeroArtifacts
        var s_ndb = getPVal("ndb"); // NativeDebug

        if (s_webrtc_type) SIPml.setWebRtcType(s_webrtc_type);

        // initialize SIPML5
        SIPml.init(postInit);

        // set other options after initialization
        if (s_fps) SIPml.setFps(parseFloat(s_fps));
        if (s_mvs) SIPml.setMaxVideoSize(s_mvs);
        if (s_mbwu) SIPml.setMaxBandwidthUp(parseFloat(s_mbwu));
        if (s_mbwd) SIPml.setMaxBandwidthDown(parseFloat(s_mbwd));
        if (s_za) SIPml.setZeroArtifacts(s_za === "true");
        if (s_ndb == "true") SIPml.startNativeDebug();
    }

    
    oReadyStateTimer = setInterval(function () {
        if (document.readyState === "complete") {
            clearInterval(oReadyStateTimer);
            // initialize SIPML5
            preInit();
        }
    },
    500);
};

function postInit() {
    sipRegister();
    // check for WebRTC support
    if (!SIPml.isWebRtcSupported()) {
        // is it chrome?
        if (SIPml.getNavigatorFriendlyName() == 'chrome') {
            if (confirm("You're using an old Chrome version or WebRTC is not enabled.\nDo you want to see how to enable WebRTC?")) {
                window.location = 'http://www.webrtc.org/running-the-demos';
            }
            else {
                window.location = "index.html";
            }
            return;
        }
        else {
            if (confirm("webrtc-everywhere extension is not installed. Do you want to install it?\nIMPORTANT: You must restart your browser after the installation.")) {
                window.location = 'https://github.com/sarandogou/webrtc-everywhere';
            }
            else {
                // Must do nothing: give the user the chance to accept the extension
                // window.location = "index.html";
            }
        }
    }

    // checks for WebSocket support
    if (!SIPml.isWebSocketSupported()) {
        if (confirm('Your browser don\'t support WebSockets.\nDo you want to download a WebSocket-capable browser?')) {
            window.location = 'https://www.google.com/intl/en/chrome/browser/';
        }
        else {
            window.location = "index.html";
        }
        return;
    }

    // FIXME: displays must be per session
    viewVideoLocal = videoLocal;
    viewVideoRemote1 = videoRemote1;
    viewVideoRemote2 = videoRemote2;

    if (!SIPml.isWebRtcSupported()) {
        if (confirm('Your browser don\'t support WebRTC.\naudio/video calls will be disabled.\nDo you want to download a WebRTC-capable browser?')) {
            window.location = 'https://www.google.com/intl/en/chrome/browser/';
        }
    }

    // btnRegister.disabled = false;
    document.body.style.cursor = 'default';
    oConfigCall = {
        audio_remote: audioRemote,
        video_local: viewVideoLocal,
        video_remote: viewVideoRemote1, // Default remote video frame
        screencast_window_id: 0x00000000,
        bandwidth: { audio: undefined, video: undefined },
        video_size: { minWidth: undefined, minHeight: undefined, maxWidth: undefined, maxHeight: undefined },
        events_listener: { events: '*', listener: onSipEventSession },
        sip_caps: [
            { name: '+g.oma.sip-im' },
            { name: 'language', value: '"en,fr"' }
        ]
    };
}

// sends SIP REGISTER request to login
function sipRegister() {
    // create SIP stack
    oSipStack = new SIPml.Stack({
        realm: "ipc.johnsamuel.in",
        impi: "802",
        impu: "sip:802@ipc.johnsamuel.in",
        password: "802@802",
        display_name: "Sarath",
        websocket_proxy_url: ("wss://ipc.johnsamuel.in:7443"),
        outbound_proxy_url: (window.localStorage ? window.localStorage.getItem('org.doubango.expert.sip_outboundproxy_url') : null),
        ice_servers: (window.localStorage ? window.localStorage.getItem('org.doubango.expert.ice_servers') : null),
        enable_rtcweb_breaker: (window.localStorage ? window.localStorage.getItem('org.doubango.expert.enable_rtcweb_breaker') == "true" : false),
        events_listener: { events: '*', listener: onSipEventStack },
        enable_early_ims: (window.localStorage ? window.localStorage.getItem('org.doubango.expert.disable_early_ims') != "true" : true), // Must be true unless you're using a real IMS network
        enable_media_stream_cache: (window.localStorage ? window.localStorage.getItem('org.doubango.expert.enable_media_caching') == "true" : false),
        bandwidth: (window.localStorage ? tsk_string_to_object(window.localStorage.getItem('org.doubango.expert.bandwidth')) : null), // could be redefined a session-level
        video_size: (window.localStorage ? tsk_string_to_object(window.localStorage.getItem('org.doubango.expert.video_size')) : null), // could be redefined a session-level
        sip_headers: [
                { name: 'User-Agent', value: 'Echo Link' },
                { name: 'Organization', value: 'BRUTE FORCE' }
        ]
    }
    );
    if (oSipStack.start() != 0) {
        txtRegStatus.innerHTML = '<b>Failed to start the SIP stack</b>';
    }
    else return;
}

function hangUp() {
    if (oSipSessionCall1) {
        oSipSessionCall1.hangup();
        oSipSessionCall1 = null;
    }

    if (oSipSessionCall2) {
        oSipSessionCall2.hangup();
        oSipSessionCall2 = null;
    }

    updateCallStatus("All calls terminated.");
    resetCallUI();
}

function resetCallUI() {
    document.getElementById("app").style.display = "flex";
    document.getElementById("divVideo").classList.add("hidden");
    document.getElementById("divVideo").classList.remove("fullscreen");
}

// Helper function to reset UI
function resetCallUI() {
    document.getElementById('app').style.display = 'flex';
    const videoContainer = document.getElementById('divVideo');
    videoContainer.classList.add('hidden');
    videoContainer.classList.remove('fullscreen');
    txtCallStatus.innerHTML = 'Call ended';
}

function sipCall(s_type, targetId, callIndex) {
    const targetNumber = document.getElementById(targetId).value;
    if (!oSipStack || !targetNumber) {
        console.error("SIP stack not initialized or target number is missing.");
        return;
    }

    let callSession;
    let videoRemote;

    if (callIndex === 1 && !oSipSessionCall1) {
        callSession = oSipSessionCall1 = oSipStack.newSession(s_type, {
            ...oConfigCall,
            video_remote: viewVideoRemote1, // Remote Video 1
        });
        videoRemote = videoRemote1;
    } else if (callIndex === 2 && !oSipSessionCall2) {
        callSession = oSipSessionCall2 = oSipStack.newSession(s_type, {
            ...oConfigCall,
            video_remote: viewVideoRemote2, // Remote Video 2
        });
        videoRemote = videoRemote2;
    } else {
        console.error("Invalid call index or session already exists.");
        return;
    }

    if (callSession.call(targetNumber) !== 0) {
        console.error(`Failed to call ${targetNumber}`);
        if (callIndex === 1) oSipSessionCall1 = null;
        if (callIndex === 2) oSipSessionCall2 = null;
    } else {
        console.log(`Calling ${targetNumber} for Call ${callIndex}`);
        updateCallStatus(`Calling ${targetNumber}...`);
        videoRemote.style.opacity = 1;
    }
}

function answerCall(session) {
    if (!session) {
        console.error('No session to answer.');
        return;
    }

    console.log('Accepting the call...');
    
    // For a conference call, we will handle multiple remote video elements
    const remoteVideoElement = session === oSipSessionCall1 ? videoRemote1 : (session === oSipSessionCall2 ? videoRemote2 : null);

    if (!remoteVideoElement) {
        console.error('No remote video element found for this session.');
        return;
    }

    // Accept the call and pass the local and remote video streams
    session.accept({
        video_local: videoLocal,    // Local video stream
        video_remote: remoteVideoElement, // Use the appropriate remote video element
        audio_remote: audioRemote,  // Remote audio stream for all participants
    });

    // Stop the ringtone (if playing)
    stopRingTone();

    // Update the video container UI
    const videoContainer = document.getElementById('divVideo');
    videoContainer.classList.remove('hidden');
    videoContainer.classList.add('fullscreen');

    // Hide the "Answer" button
    document.getElementById('btnAnswer').style.display = 'none';

    // Update the call status
    const label = session === oSipSessionCall1 ? 'Remote 1' : 'Remote 2';
    updateCallStatus(`Call accepted and displayed in ${label}.`);
}

function setupIncomingCall(session, videoElement, label) {
    // Configure the session with the appropriate video elements
    session.setConfiguration({
        video_remote: videoElement,  // Assign remote video
        video_local: videoLocal,    // Local video for the call
        audio_remote: audioRemote,  // Remote audio for the call
        events_listener: { events: '*', listener: onSipEventSession }, // Bind session events
    });

    // Show the "Answer" button
    const answerButton = document.getElementById('btnAnswer');
    answerButton.style.display = 'block';

    // Dynamically bind the session to the "Answer" button's click handler
    answerButton.onclick = function () {
        console.log(`Answering call for ${label}`);
        answerCall(session); // Pass the session object to answer the call
    };

    // Update the call status to indicate an incoming call
    updateCallStatus(`Incoming call for ${label}`);
}

function sipSendDTMF(c) {
    if (oSipSessionCall && c) {
        if (oSipSessionCall.dtmf(c) == 0) {
            try { dtmfTone.play(); } catch (e) { }
        }
    }
}

function startRingTone() {
    try { ringtone.play(); }
    catch (e) { }
}

function stopRingTone() {
    try { ringtone.pause(); }
    catch (e) { }
}

function startRingbackTone() {
    try { ringbacktone.play(); }
    catch (e) { }
}

function stopRingbackTone() {
    try { ringbacktone.pause(); }
    catch (e) { }
}

function fullScreen(b_fs) {
    bFullScreen = b_fs;
    if (tsk_utils_have_webrtc4native() && bFullScreen && videoRemote.webkitSupportsFullscreen) {
        if (bFullScreen) {
            videoRemote.webkitEnterFullScreen();
        }
        else {
            videoRemote.webkitExitFullscreen();
        }
    }
    else {
        if (tsk_utils_have_webrtc4npapi()) {
            try { if (window.__o_display_remote) window.__o_display_remote.setFullScreen(b_fs); }
            catch (e) { divVideo.setAttribute("class", b_fs ? "full-screen" : "normal-screen"); }
        }
        else {
            divVideo.setAttribute("class", b_fs ? "full-screen" : "normal-screen");
        }
    }
}

function showNotifICall(s_number) {
    // permission already asked when we registered
    if (window.webkitNotifications && window.webkitNotifications.checkPermission() == 0) {
        if (oNotifICall) {
            oNotifICall.cancel();
        }
        oNotifICall = window.webkitNotifications.createNotification('images/sipml-34x39.png', 'Incaming call', 'Incoming call from ' + s_number);
        oNotifICall.onclose = function () { oNotifICall = null; };
        oNotifICall.show();
    }
}

function onKeyUp(evt) {
    evt = (evt || window.event);
    if (evt.keyCode == 27) {
        fullScreen(false);
    }
    else if (evt.ctrlKey && evt.shiftKey) { // CTRL + SHIFT
        if (evt.keyCode == 65 || evt.keyCode == 86) { // A (65) or V (86)
            bDisableVideo = (evt.keyCode == 65);
            txtCallStatus.innerHTML = '<i>Video ' + (bDisableVideo ? 'disabled' : 'enabled') + '</i>';
            window.localStorage.setItem('org.doubango.expert.disable_video', bDisableVideo);
        }
    }
}

function onDivCallCtrlMouseMove(evt) {
    try { // IE: DOM not ready
        if (tsk_utils_have_stream()) {
            btnCall.disabled = (!tsk_utils_have_stream() || !oSipSessionRegister || !oSipSessionRegister.is_connected());
            document.getElementById("divCallCtrl").onmousemove = null; // unsubscribe
        }
    }
    catch (e) { }
}

function uiOnConnectionEvent(b_connected, b_connecting) { // should be enum: connecting, connected, terminating, terminated
    hangUp.disabled = !(b_connected && tsk_utils_have_webrtc() && tsk_utils_have_stream());
}

function uiVideoDisplayEvent(b_local, b_added) {
    var o_elt_video;
    
    // Check which session is active and assign the correct remote video
    if (b_local) {
        o_elt_video = videoLocal;
    } else {
        // If session 1 is active, use videoRemote1, otherwise use videoRemote2
        o_elt_video = oSipSessionCall1 ? videoRemote1 : (oSipSessionCall2 ? videoRemote2 : null);
    }
    
    if (!o_elt_video) {
        console.error('No valid video element found.');
        return;
    }
    
    if (b_added) {
        o_elt_video.style.opacity = 1;
        uiVideoDisplayShowHide(true);
    } else {
        o_elt_video.style.opacity = 0;
        fullScreen(false);
    }
}



function uiVideoDisplayShowHide(b_show) {
    const divVideo = document.getElementById("divVideo");
    const hangupButton = document.getElementById("hangupButton"); // Get the Hang Up button

    if (!divVideo || !hangupButton) {
        console.error("divVideo or hangupButton not found in the DOM");
        return; // Exit if divVideo or hangupButton is null
    }

    if (b_show) {
        divVideo.style.height = '100%'; // Adjust to show the video container fully
        divVideo.classList.remove("hidden"); // Make the video container visible
        divVideo.classList.add("fullscreen"); // Add fullscreen styling
        hangupButton.style.display = "block"; // Show the Hang Up button
    } else {
        divVideo.style.height = '0px'; // Collapse the video container
        divVideo.classList.add("hidden"); // Hide the video container
        divVideo.classList.remove("fullscreen"); // Remove fullscreen styling
        hangupButton.style.display = "none"; // Hide the Hang Up button
    }
}


function uiDisableCallOptions() {
    if (window.localStorage) {
        window.localStorage.setItem('org.doubango.expert.disable_callbtn_options', 'true');
        uiBtnCallSetText('Call');
        alert('Use expert view to enable the options again (/!\\requires re-loading the page)');
    }
}

function uiBtnCallSetText(s_text) {
    switch (s_text) {
        case "Call":
            {
                var bDisableCallBtnOptions = (window.localStorage && window.localStorage.getItem('org.doubango.expert.disable_callbtn_options') == "true");
                btnCall.value = btnCall.innerHTML = bDisableCallBtnOptions ? 'Call' : 'Call <span id="spanCaret" class="caret">';
                btnCall.setAttribute("class", bDisableCallBtnOptions ? "btn btn-primary" : "btn btn-primary dropdown-toggle");
                btnCall.onclick = bDisableCallBtnOptions ? function () { sipCall(bDisableVideo ? 'call-audio' : 'call-audiovideo'); } : null;
                ulCallOptions.style.visibility = bDisableCallBtnOptions ? "hidden" : "visible";
                if (!bDisableCallBtnOptions && ulCallOptions.parentNode != divBtnCallGroup) {
                    divBtnCallGroup.appendChild(ulCallOptions);
                }
                else if (bDisableCallBtnOptions && ulCallOptions.parentNode == divBtnCallGroup) {
                    document.body.appendChild(ulCallOptions);
                }

                break;
            }
        default:
            {
                btnCall.value = btnCall.innerHTML = s_text;
                btnCall.setAttribute("class", "btn btn-primary");
                btnCall.onclick = function () { sipCall(bDisableVideo ? 'call-audio' : 'call-audiovideo'); };
                ulCallOptions.style.visibility = "hidden";
                if (ulCallOptions.parentNode == divBtnCallGroup) {
                    document.body.appendChild(ulCallOptions);
                }
                break;
            }
    }
}

function uiCallTerminated(s_description) {
    // Reset the UI to the initial state
    hangUp.value = 'HangUp';
    btnCall.disabled = false;
    hangUp.disabled = true;

    oSipSessionCall = null;

    stopRingbackTone();
    stopRingTone();

    txtCallStatus.innerHTML = "<i>" + s_description + "</i>";
    uiVideoDisplayShowHide(false);

    // Restore the app div and hide the video section
    document.getElementById('app').style.display = 'flex';
    const videoContainer = document.getElementById('divVideo');
    videoContainer.classList.remove('fullscreen');
    videoContainer.classList.add('hidden');

    if (oNotifICall) {
        oNotifICall.cancel();
        oNotifICall = null;
    }

    uiVideoDisplayEvent(false, false);
    uiVideoDisplayEvent(true, false);

    setTimeout(function () {
        if (!oSipSessionCall) txtCallStatus.innerHTML = '';
    }, 2500);
}

let txtCallStatus = document.getElementById("txtCallStatus");
function updateCallStatus(message) {
    const txtCallStatus = document.getElementById("txtCallStatus");
    if (txtCallStatus) {
        txtCallStatus.textContent = message;
        txtCallStatus.style.display = "block";
    } else {
        console.error("Call status element not found.");
    }
}

function answerCall(session) {
    if (!session) {
        console.error('No session to answer.');
        return;
    }

    console.log('Accepting the call...');
    
    // For a conference call, we will handle multiple remote video elements
    const remoteVideoElement = session === oSipSessionCall1 ? videoRemote1 : (session === oSipSessionCall2 ? videoRemote2 : null);

    if (!remoteVideoElement) {
        console.error('No remote video element found for this session.');
        return;
    }

    // Accept the call and pass the local and remote video streams
    session.accept({
        video_local: videoLocal,    // Local video stream
        video_remote: remoteVideoElement, // Use the appropriate remote video element
        audio_remote: audioRemote,  // Remote audio stream for all participants
    });

    // Stop the ringtone (if playing)
    stopRingTone();

    // Update the video container UI
    const videoContainer = document.getElementById('divVideo');
    videoContainer.classList.remove('hidden');
    videoContainer.classList.add('fullscreen');

    // Hide the "Answer" button
    document.getElementById('btnAnswer').style.display = 'none';

    // Update the call status
    const label = session === oSipSessionCall1 ? 'Remote 1' : 'Remote 2';
    updateCallStatus(`Call accepted and displayed in ${label}.`);
}

function setupIncomingCall(session, videoElement, label) {
    // Configure the session with the appropriate video elements
    session.setConfiguration({
        video_remote: videoElement,  // Assign remote video
        video_local: videoLocal,    // Local video for the call
        audio_remote: audioRemote,  // Remote audio for the call
        events_listener: { events: '*', listener: onSipEventSession }, // Bind session events
    });

    // Show the "Answer" button
    const answerButton = document.getElementById('btnAnswer');
    answerButton.style.display = 'block';

    // Dynamically bind the session to the "Answer" button's click handler
    answerButton.onclick = function () {
        console.log(`Answering call for ${label}`);
        answerCall(session); // Pass the session object to answer the call
    };

    // Update the call status to indicate an incoming call
    updateCallStatus(`Incoming call for ${label}`);
}

function setupConferenceCall(session, participantId) {
    // Assign a unique video element for each participant
    let videoRemoteElement;
    if (participantId === 1) {
        videoRemoteElement = videoRemote1;
    } else if (participantId === 2) {
        videoRemoteElement = videoRemote2;
    } else if (participantId === 3) {
        videoRemoteElement = videoRemote3;
    }
    // Add more cases as needed for additional participants...

    session.setConfiguration({
        video_remote: videoRemoteElement, // Assign the remote video to the correct element
        video_local: videoLocal,  // Local video for the current participant
        audio_remote: audioRemote, // Audio for the current participant
        events_listener: { events: '*', listener: onSipEventSession }, // Event listener for the session
    });
    
    // Dynamically show the incoming call info for all participants
    updateCallStatus(`Incoming conference call for Participant ${participantId}`);
}


function handleIncomingCall(newSession) {
    console.log('Incoming call detected.');
    if (oSipSessionCall1 && oSipSessionCall2) {
        console.log('Already handling two calls. Rejecting the new call.');
        newSession.reject();
        return;
    }

    const availableSession = !oSipSessionCall1 ? 1 : 2;
    if (availableSession === 1) {
        oSipSessionCall1 = newSession;
        setupIncomingCall(newSession, videoRemote1, 'Remote 1');
    } else {
        oSipSessionCall2 = newSession;
        setupIncomingCall(newSession, videoRemote2, 'Remote 2');
    }
}

// Callback function for SIP Stacks
function onSipEventStack(e /*SIPml.Stack.Event*/) {
    tsk_utils_log_info('==stack event = ' + e.type);
    switch (e.type) {
        case 'started':
            try {
                oSipSessionRegister = this.newSession('register', {
                    expires: 200,
                    events_listener: { events: '*', listener: onSipEventSession },
                });
                oSipSessionRegister.register();
            } catch (err) {
                console.error("Error during registration:", err);
            }
            break;
        case 'failed_to_start':
        case 'failed_to_stop':
            console.error(`SIP stack ${e.type}: ${e.description}`);
            break;
        case 'stopping': case 'stopped': case 'failed_to_start': case 'failed_to_stop':
            {
                var bFailure = (e.type == 'failed_to_start') || (e.type == 'failed_to_stop');
                oSipStack = null;
                oSipSessionRegister = null;
                oSipSessionCall = null;

                uiOnConnectionEvent(false, false);

                stopRingbackTone();
                stopRingTone();

                uiVideoDisplayShowHide(false);
                // divCallOptions.style.opacity = 0;

                txtCallStatus.innerHTML = '';
                txtRegStatus.innerHTML = bFailure ? "<i>Disconnected: <b>" + e.description + "</b></i>" : "<i>Disconnected</i>";
                break;
            }

            case 'i_new_call':
            {
                const incomingSession = e.newSession;

                if (oSipSessionCall1 && oSipSessionCall2) {
                    console.log('Already handling two calls. Rejecting the new call.');
                    incomingSession.reject();
                } else if (!oSipSessionCall1) {
                    oSipSessionCall1 = incomingSession;
                    setupIncomingCall(oSipSessionCall1, videoRemote1, 'Remote 1');
                } else {
                    oSipSessionCall2 = incomingSession;
                    setupIncomingCall(oSipSessionCall2, videoRemote2, 'Remote 2');
                }
                break;
            }

        case 'm_permission_requested':
            {
                // divGlassPanel.style.visibility = 'visible';
                break;
            }
        case 'm_permission_accepted':
        case 'm_permission_refused':
            {
                // divGlassPanel.style.visibility = 'hidden';
                if (e.type == 'm_permission_refused') {
                    uiCallTerminated('Media stream permission denied');
                }
                break;
            }

        case 'starting': default: break;
    }
};

function onSipEventSession(e /* SIPml.Session.Event */) {
    console.log('==session event = ' + e.type);

    // Check if the event is related to oSipSessionCall1 or oSipSessionCall2
    const session = e.session;
    const isSessionCall1 = session === oSipSessionCall1;
    const isSessionCall2 = session === oSipSessionCall2;

    switch (e.type) {
        case 'connecting':
        case 'connected':
            {
                const bConnected = (e.type === 'connected');
                if (session === oSipSessionRegister) {
                    uiOnConnectionEvent(bConnected, !bConnected);
                    updateCallStatus('Online');
                } else if (isSessionCall1 || isSessionCall2) {
                    const callIndex = isSessionCall1 ? 1 : 2;
                    console.log(`Session ${callIndex} is ${e.type}.`);

                    if (bConnected) {
                        stopRingbackTone();
                        stopRingTone();
                        if (oNotifICall) {
                            oNotifICall.cancel();
                            oNotifICall = null;
                        }
                    }

                    txtCallStatus.innerHTML = `<i>${e.description}</i>`;
                    divCallOptions.style.opacity = bConnected ? 1 : 0;

                    if (SIPml.isWebRtc4AllSupported()) {
                        // IE doesn't provide stream callbacks
                        uiVideoDisplayEvent(false, true);
                        uiVideoDisplayEvent(true, true);
                    }
                }
                break;
            }
        case 'terminating':
        case 'terminated':
            {
                if (isSessionCall1 || isSessionCall2) {
                    const callIndex = isSessionCall1 ? 1 : 2;
                    console.log(`Session ${callIndex} is ${e.type}.`);
                    updateCallStatus('Call terminated');

                    if (isSessionCall1) oSipSessionCall1 = null;
                    if (isSessionCall2) oSipSessionCall2 = null;

                    // Reset UI
                    document.getElementById('app').style.display = 'flex';
                    const videoContainer = document.getElementById('divVideo');
                    videoContainer.classList.add('hidden');
                    videoContainer.classList.remove('fullscreen');

                    stopRingbackTone();
                    stopRingTone();
                }
                break;
            }
        case 'm_stream_video_local_added':
            {
                if (isSessionCall1 || isSessionCall2) {
                    uiVideoDisplayEvent(true, true);
                }
                break;
            }
        case 'm_stream_video_remote_added':
            {
                if (isSessionCall1 || isSessionCall2) {
                    uiVideoDisplayEvent(false, true);
                }
                break;
            }
        case 'm_stream_video_local_removed':
        case 'm_stream_video_remote_removed':
            {
                if (isSessionCall1 || isSessionCall2) {
                    uiVideoDisplayEvent(e.type.includes('local'), false);
                }
                break;
            }
        case 'i_ao_request':
            {
                if (isSessionCall1 || isSessionCall2) {
                    const callIndex = isSessionCall1 ? 1 : 2;
                    const iSipResponseCode = e.getSipResponseCode();
                    if (iSipResponseCode === 180 || iSipResponseCode === 183) {
                        startRingbackTone();
                        updateCallStatus(`Session ${callIndex} is ringing...`);
                    }
                }
                break;
            }
        case 'm_early_media':
            {
                if (isSessionCall1 || isSessionCall2) {
                    stopRingbackTone();
                    stopRingTone();
                    updateCallStatus('Early media started');
                }
                break;
            }
        case 'm_bfcp_info':
            {
                if (isSessionCall1 || isSessionCall2) {
                    txtCallStatus.innerHTML = `BFCP Info: <i>${e.description}</i>`;
                }
                break;
            }
    }
}
