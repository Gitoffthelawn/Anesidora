var callback;
var currentSong;
var comingSong;
var prevSongs = new Array();
var errorCount = 0;
$(document).ready(
function () {
    if (localStorage.volume) {
        mp3Player.volume = localStorage.volume;
    }
    else {
        mp3Player.volume = .1;
    }
    $('#mp3Player')
    .bind('pause', function () {
        chrome.browserAction.setTitle({ 'title': 'Anesidora' })
    })
    .bind('play', function () {
        callback.updatePlayer();
        currentSong.startTime = Math.round(new Date().getTime() / 1000);
        if (localStorage.lastFm == "true") {
            lastFmNowPlaying();
        }
    })
    .bind('ended', function () {
        if (localStorage.lastFm == "true") {
            lastFmScrobble();
        }
        if (currentSong.songRating != '1') {
            if (prevSongs.push(currentSong) == 5) {
                prevSongs.shift();
            }
        }
        errorCount = 0;
        nextSong();
    })
    .bind('timeupdate', function () {
        callback.drawPlayer();
    })
    .bind('error', function () {
        if (errorCount > 3) {
            alert("There seems to be an issue with Anesidora. To prevent Pandora account lockout Anesidora has been stopped.");
            return;
        }
        errorCount++;
        nextSong();
    })
    chrome.omnibox.onInputChanged.addListener(
        function (text, suggest) {
            var suggestions = [{ content: "Play", description: "Play current station" },
                                { content: "Pause", description: "Pause current station" },
                                { content: "Skip", description: "Skip current song" },
                                { content: "Like", description: "Like current song" },
                                { content: "Dislike", description: "Dislike current song" },
                                { content: "Tired", description: "Sleep current song" },
                                { content: "Station", description: "[Station name]" },
                                { content: "Volume", description: "[Volume]"}];
            if (text.toLowerCase().match('station')) {
                suggestions = [];
                var string = text.toLowerCase().replace("station ", "");
                for (x = 0; x < userStations.length; x++) {
                    if (userStations[x].name.toLowerCase().indexOf(string) != -1) {
                        suggestions.push({
                            content: "Station " + userStations[x].name,
                            description: "<dim>Station </dim><match>" + userStations[x].name + "</match>"
                        });
                    }
                }
            }
            suggest(suggestions);
        }
    );
    chrome.omnibox.onInputEntered.addListener(
        function (text) {
            console.log(text);
            if (text.toLowerCase().match('play')) {
                if (mp3Player.src != "") {
                    mp3Player.play();
                }
                else {
                    play(localStorage.lastStation);
                }
            }
            if (text.toLowerCase().match('pause')) {
                mp3Player.pause();
            }
            if (text.toLowerCase().match('skip')) {
                nextSong();
            }
            if (text.toLowerCase().match('like')) {
                addFeedback("1", "-1");
            }
            if (text.toLowerCase().match('dislike')) {
                addFeedback("0", "-1");
            }
            if (text.toLowerCase().match('tired')) {
                sleepSong();
            }
            if (text.toLowerCase().match('station')) {
                var string = text.toLowerCase().replace("station ", "");
                for (x = 0; x < userStations.length; x++) {
                    if (userStations[x].name.toLowerCase().indexOf(string) == 0) {
                        play(userStations[x].id);
                    }
                }
            }
            if (text.toLowerCase().match('volume')) {
                mp3Player.volume = text.toLowerCase().replace("volume ", "") / 100;

            }
        }
    );
    chrome.extension.onRequest.addListener(function (request, sender, callback) {
        // console.debug(request);
        switch (request) {
            case "play":
                if (mp3Player.paused) {
                    if (mp3Player.src != "") {
                        mp3Player.play();
                    }
                    else {
                        play(localStorage.lastStation);
                    }
                }
                else {
                    mp3Player.pause();
                }
                break;
            case "skip":
                setTimeout(nextSong(), 1000); // Small delay to stop extension from freezing for some reason
                break;
            case "like":
                addFeedback("1", "-1");
                break;
            case "dislike":
                addFeedback("0", "-1");
                setTimeout(nextSong(), 1000); // Small delay to stop extension from freezing for some reason
                break;
            case "tired":
                sleepSong();
                setTimeout(nextSong(), 1000); // Small delay to stop extension from freezing for some reason
                break;
            default:
                return;
        }
    });
});
function setCallbacks(updatePlayer, drawPlayer, downloadSong) {
    callback = { "updatePlayer": updatePlayer, "drawPlayer": drawPlayer ,"downloadSong":downloadSong };
}
if (localStorage.username != '' && localStorage.password != '') {
    partnerLogin();
}
function play(stationToken) {
    if (stationToken != localStorage.lastStation) {
        currentSong = undefined;
        getPlaylist(stationToken);
        localStorage.lastStation = stationToken;
        nextSong();
    }
    else {
        if (currentSong == undefined) {
            getPlaylist(localStorage.lastStation);
        }
        if (document.getElementById("mp3Player").currentTime > 0) {
            mp3Player.play();
        }
        else {
            nextSong();
        }
    }
}
function nextSong() {
    if (currentSong == undefined) {
        while (currentSong == undefined) {
            currentSong = currentPlaylist.shift();
        }
    }
    else {
        currentSong = comingSong;
    }
    if (currentPlaylist.length == 0) {
        getPlaylist(localStorage.lastStation);
    }
    comingSong = currentPlaylist.shift();

    if (localStorage.notifications == "true") {
        var options = {
            type: "list",
            title: "Now playing:\r\n" + currentSong.artistName + " - " + currentSong.songName,
            message: "by " + currentSong.artistName,
            eventTime: 5000,
            items: [
                { title: "", message: "Coming next: " },
                { title: "", message: comingSong.artistName + " - " + comingSong.songName }
            ]
        }
        chrome.notifications.clear("now_playing", function(wasCleared){});

        var xhr = new XMLHttpRequest();
        xhr.open("GET", currentSong.albumArtUrl);
        xhr.responseType = "blob";
        xhr.onload = function(){
            var blob = this.response;
            options.iconUrl = window.URL.createObjectURL(blob);
            chrome.notifications.create("now_playing", options, function() {});
        };
        xhr.send(null);
    }
    chrome.browserAction.setTitle({ "title": currentSong.artistName + " - " + currentSong.songName });
    if (currentSong.additionalAudioUrl != null) {
        mp3Player.setAttribute("src", currentSong.additionalAudioUrl);
    }
    else {
        mp3Player.setAttribute("src", currentSong.audioUrlMap.highQuality.audioUrl);
    }
    mp3Player.play();
}
function downloadSong() {
	var url='';
	if (currentSong.additionalAudioUrl != null) {
		console.log('Downloading alternate url');
		console.log(currentSong);
		url=currentSong.additionalAudioUrl;
	}	else {
		console.log('Downloading normal url');
		console.log(currentSong);
		url=currentSong.audioUrlMap.highQuality.audioUrl;
	}
	callback.downloadSong(url,currentSong.songName);
}

var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-43432184-3']);
_gaq.push(['_trackPageview']);
(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

