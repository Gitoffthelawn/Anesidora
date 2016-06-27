﻿var currentPanel = null

var background = chrome.extension.getBackgroundPage();
background.setCallbacks(updatePlayer, drawPlayer,downloadSong);
$(document).ready(
function () {
    //////////////////////////////
    //  Load jQuery bindings    //
    //////////////////////////////
    $('body').bind('click', 
			function (e) { 
				if (e.target.id != 'artistLink' && e.target.id != 'titleLink') { 
					$('.details').hide() 
				} 
			});
		initBodySize();
		$('body').width(localStorage.bodyWidth);
		$('body').height(localStorage.bodyHeight);

		$('.panel,#stationList,#historyDiv').css({
			'height':$('body').height(),
			'width':$('body').width()
		});
		$('#stationList').css({
			'width':$('body').width()-30
		});
		$('#historyDiv,#historyList').css({
			'width':$('body').width()-20
		});
		$('#volume').css({
			'height':$('body').height()-5
		});
		$('#coverArt').css({
			'min-width':Math.min($('body').height()*.75,$('body').width()*.1)
		});

		if(background.mp3Player.paused){
			$('pauseButton').hide();
			$('playButton').show();
		} else {
			$('pauseButton').show();
			$('playButton').hide();
		}
		$('.panel').hide();

    $('#scrubber').slider({
        range: "min",
        min: 0,
        slide: function (event, ui) {
            background.mp3Player.currentTime = background.mp3Player.duration * (ui.value / 100);
        },
        change: function (event, ui) {
            $(ui.handle).removeClass('ui-state-focus');
        }
    });

    $('#playButton').bind('click', function () { background.play(localStorage.lastStation); $(this).hide(); });
    $('#pauseButton').bind('click', function () { background.mp3Player.pause(); $(this).hide(); $('#playButton').show(); });
    $('#skipButton').bind('click', background.nextSong);
    $('#tUpButton').bind('click', function () {
        background.addFeedback(-1, true);
        if (background.currentSong.songRating == true) {
            $(this).unbind('click').attr('src', 'images/thumbUpCheck.png');
        }
    });
    $('#tDownButton').bind('click', function () {
        background.addFeedback(-1, false);
        setTimeout(function(){background.nextSong();}, 1000); // Small delay to stop extension from freezing for some reason
    });
    $('#sleepButton').bind('click', function () { background.sleepSong(); background.nextSong(); });
		$('#downloadButton').bind('click',function(){ background.downloadSong(); });
		$('#moreInfoButton').bind('click',function(){ window.open('options.htm','_blank');	});
    $('#volume').slider({
        orientation: 'vertical',
        range: 'min',
        min: 0,
        max: 70,
        value: (localStorage.volume) ? localStorage.volume * 100 : ".2",
        slide: function (event, ui) {
            background.mp3Player.volume = ui.value / 100;
        },
        stop: function (event, ui) {
            $(ui.handle).removeClass('ui-state-focus');
            localStorage.volume = ui.value / 100;
        }
    });
    $('#nextButton').bind('click', function () {
				//move to midpanel
				goToStations();
    });
    $('#stationList').bind('dblclick keyup', function (e) {
        if (e.type == "dblclick" || e.keyCode == "13") {
            background.play($(this).val());
            goToPlayer();
        }
    });
    $('#unWarning').hide();
    $('#pwWarning').hide();
    $('#login')
        .bind('submit', function () {
            localStorage.username = $('#username').val();
            localStorage.password = $('#password').val();
            background.partnerLogin();
            if (background.userAuthToken == "") {
                $('#unWarning').show();
                $('#pwWarning').show();
                $('#username').css({ 'padding-left': '16px', 'width': '216px' });
                $('#password').css({ 'padding-left': '16px', 'width': '216px' });
                return false;
            }
            else {
							addStations();
								//move to mid panel	
								goToStations();
                return false;
            }
        });

    ///////////////////
    //  Misc loads   //
    ///////////////////
    if (typeof background.stationList != "undefined") {
			addStations();
    }
    if (
			localStorage.username == undefined
			|| localStorage.password == undefined
			|| background.userAuthToken == undefined
			|| localStorage.username.length==0 
			|| localStorage.password.length==0 
			|| background.userAuthToken.length==0) {
			goToLogin();
    } else {
			if (!localStorage.lastStation) {
				goToStations();
			}
			if(localStorage.lastStation){
				goToPlayer();
			}
		}

		$('#prevButton').bind('click', function () { goToPlayer(); });
		$('#history').bind('click', function(e){ goToHistory(); });
		$('#noHistory').bind('click', function(e){ goToPlayer();});
		

    if (background.mp3Player.src != "") {
			if (background.mp3Player.currentTime > 0) {
				updatePlayer();
				drawPlayer();
			}
    }
    else {
			updatePlayer();
    }
});
function initBodySize(){
	if(localStorage.bodyWidth===undefined
			|| localStorage.bodyWidth===0){
		localStorage.bodyWidth=options.default_width;
	}
	if(localStorage.bodyHeight===undefined
			|| localStorage.bodyHeight===0){
		localStorage.bodyHeight=options.default_height;
	}
	$('#bodyWidth').val(localStorage.bodyWidth);
	$('#bodyHeight').val(localStorage.bodyHeight);
}

function goToPanel(id){
	var panel = $(id);
	if(currentPanel !== null){
		if(currentPanel.attr('id') === panel.attr('id')){
			return;
		}
		//hide the other panel
		currentPanel.hide();
	}
	currentPanel = panel;
	currentPanel.show();
}

function goToLogin(){
	goToPanel('#rightPanel');
}
function goToStations(){
	goToPanel('#midPanel');
}
function goToPlayer() {
	goToPanel('#leftPanel');
}
function goToHistory() {
	goToPanel('#historyPanel');
	updateHistory();
}
function updateHistory() {
	clearHistory();

	var history = document.getElementById('historyList');
	for(var i = background.prevSongs.length-1;i>=0;--i){
		var song = background.prevSongs[i];
		var row = history.insertRow();

		var imgCell = row.insertCell();
		imgCell.innerHTML='<img src="'+song.albumArtUrl+'" class="historyCoverArt historyInfoLink" data-history='+i+' />';

		var nameCell = row.insertCell();
		nameCell.noWrap=true;
		nameCell.style="max-width:"+($('body').width()*.5)+"px";
		nameCell.innerHTML='<span data-history='+i+' class="historyInfoLink historyTitle">'+song.songName+'</span>';

		var likeCell = row.insertCell();
		likeCell.innerHTML = '<img src="images/thumbup.png" data-history='+i+' class="hoverImg historyLike" />';

		//dislikes aren't done yet
		//var dislikeCell = row.insertCell();
		//dislikeCell.innerHTML = '<img src="images/thumbdown.png" data-history='+i+' class="hoverImg historyDislike" />';

		var dlCell = row.insertCell();
		dlCell.innerHTML = '<img src="images/download.png" data-history='+i+' class="hoverImg historyDownload" />';
	}
	$('.historyInfoLink').bind('click',function(e){
		var historyNum=e.target.dataset['history'];
		var song = background.prevSongs[historyNum];
		chrome.tabs.create({ "url": song.songDetailUrl });
	});
	$('.historyLike').bind('click',function(e){
		var historyNum=e.target.dataset['history'];
		background.addFeedback(historyNum,true);	

		$(this).unbind('click').attr('src', 'images/thumbUpCheck.png');
	});
	//$('.historyDislike').bind('click',function(e){
		//var historyNum=e.target.dataset['history'];
		//background.addFeedback(historyNum,false);	

		//$(this).unbind('click').attr('src', 'images/thumbUpCheck.png');
	//});
	$('.historyDownload').bind('click',function(e){
		var historyNum=e.target.dataset['history'];
		var song= background.prevSongs[historyNum];
		
		downloadSong(song.audioUrlMap.highQuality.audioUrl,song.songName);
	});
}
function clearHistory() {
	document.getElementById('historyList').innerHTML="";
}
function clearStations() {
	for(var i=0;i<$('#stationList').length;++i){
		$('#stationList').remove(i);
	}
}
function addStations() {
	for (var i = 0; i < background.stationList.length; i++) {
			$('#stationList').append(new Option(background.stationList[i].stationName, background.stationList[i].stationToken));
	}
}
function refreshStations() {
	clearStations();
	addStations();
}
function updatePlayer() {
    if (background.currentSong) {
        $('#coverArt').unbind().bind('click', function () { chrome.tabs.create({ "url": background.currentSong.albumDetailUrl }) }).attr('src', background.currentSong.albumArtUrl);
       $('#artistLink').unbind().text(background.currentSong.artistName);
       $('#titleLink').unbind().text(background.currentSong.songName);
        $('#artistLink').unbind().bind('click', function (e) { chrome.tabs.create({ "url": background.currentSong.artistDetailUrl }) }).text(background.currentSong.artistName);
        $('#titleLink').unbind().bind('click', function (e) {  chrome.tabs.create({ "url": background.currentSong.songDetailUrl }) }).text(background.currentSong.songName);
        $('#dash').text(" - ");
        if (background.currentSong.songRating==false) {
            $('#tUpButton').unbind('click').bind('click', function () { background.addFeedback(-1, true); $(this).attr('src', 'images/thumbUpCheck.png'); }).attr('src', 'images/thumbup.png');
        }
        else {
            $('#tUpButton').unbind('click').attr('src', 'images/thumbUpCheck.png');
        }
    }
    if (background.mp3Player.paused) {
        $('#playButton').show();
        $('#pauseButton').hide();
    }
    else {
        $('#playButton').hide();
        $('#pauseButton').show();
    }
		$('.scrollerText').hover(function(){
			if ($(this).width() > $(this).parent().width()) {
				var newLeft = $(this).parent().width() - ($(this).width());
				var speed = Math.round(($(this).width() - $(this).parent().width() + $(this).position().left) * 10);
				$(this).stop().delay(500).animate({ left: newLeft }, speed);
			}
		},function(){
			//move it to left immediately
			$(this).stop().css({left:0});
		});
    $('#scrubber')
    .slider({
        value: 0
    })
}
function drawPlayer() {
    $('#scrubber')
    .slider({
        value: (background.mp3Player.currentTime / background.mp3Player.duration) * 100
    })
    .attr("title",
    Math.floor(background.mp3Player.currentTime / 60) +
    ":" +
        zeroPad(
            (Math.ceil(background.mp3Player.currentTime % 60).length == 1 ? '0' + Math.ceil(background.mp3Player.currentTime % 60) : Math.ceil(background.mp3Player.currentTime % 60)),
            2) +
    "/" +
    Math.floor(background.mp3Player.duration / 60) +
    ":" +
        zeroPad(
            (Math.ceil(background.mp3Player.duration % 60).length == 1 ? '0' + Math.ceil(background.mp3Player.duration % 60) : Math.ceil(background.mp3Player.duration % 60)),
            2)
    );
}
function downloadSong(url,title){
	//making an anchor tag and clicking it allows the download dialog to work and save the file with the song's name
	var a = $('<a href="'+url+'" download="'+title+'.mp4">HELLO</a>');
	a.appendTo('body');
	a[0].click();
	a.remove();
}
//function for adding leading zeros. took from here: http://stackoverflow.com/a/2998874 [BukeMan]
function zeroPad(num, places) {
    var zero = places - num.toString().length + 1;
    return Array(+(zero > 0 && zero)).join("0") + num;
}
