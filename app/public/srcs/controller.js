(function() {

/**
 * Handles OI Server-Client Communication
 */
var socket = io.connect(window.location.href);

// this object contains all the event names that will
// be communicated on Socket.IO, we take this from the
// server so that we don't have to duplicate the names
// at client side (see the "connected" IO event)
var IOEvents,
    ViewEvents = tgo.views.Events;

// our local reference for the objects to prevent too much typing
// as well as useful in minification
var game = tgo.models.game,
    welcomeView = tgo.views.welcomeView,
    gameView = tgo.views.gameView,
    chatView = tgo.views.chatView,
    msgbox = tgo.views.msgbox;

// when we connected, we want to watch for some events
// which are defined in the server (IOEvents)
socket.on('connected', function(data) {
    // let's get the event names from the server
    IOEvents = data;

    // now let's attach all our IO events
    socket.on(IOEvents.GAME_CREATED, onGameCreated);
    socket.on(IOEvents.PLAYER_JOINED, onPlayerJoined);
    socket.on(IOEvents.PIECES_SUBMITTED, onPiecesSubmitted);
    socket.on(IOEvents.PIECE_SELECTED, onOpponentGamePieceSelected);
    socket.on(IOEvents.PLAYER_TAKES_TURN, onPlayerTakesTurn);
    socket.on(IOEvents.PLAYER_LEFT, onPlayerLeft);
    socket.on(IOEvents.CHAT_MESSAGE, onRecieveChatMessage);

});

// handle view events
welcomeView.on(ViewEvents.CREATE_GAME, onViewCreateGame);
welcomeView.on(ViewEvents.JOIN_GAME, onViewJoinGame);

gameView.on(ViewEvents.PLAY_AI, onViewPlayAI);
gameView.on(ViewEvents.SUBMIT_PIECES, onViewSubmitPieces);
gameView.on(ViewEvents.GAME_PIECE_SELECTED, onViewGamePieceSelected);
gameView.on(ViewEvents.TAKE_TURN, onViewMovesGamePiece);

chatView.on(ViewEvents.CHAT_MESSAGE, onSendChatMessage);

// Now, let's start and see the welcome view
welcomeView.show();

/**
 * Source:  View
 * Handles: When the player want's to create a new game
 * Data:    playerName
 */
function onViewCreateGame(data) {
    socket.emit(IOEvents.CREATE_GAME, data);
}

/**
 * Source:  Socket.IO
 * Handles: When the server says we have created a game
 * Data:    success, gameId, playerId, playerName
 */
function onGameCreated(data) {
    if (data.success) {
        game.init(data.gameId, data.playerId, sanitizeHtml(data.playerName));
        game.isCreated = true;
        gameView.show();
    } else {
        msgbox.show(data.error);
    }
}

/**
 * Source:  View
 * Handles: When a user likes to play with AI
 * Data:    gameId, playerName
 */
function onViewPlayAI() {
    socket.emit(IOEvents.PLAY_AI, {
        gameId: game.id,
        // THINK: i have been looking for a way to get this url from the server side
        // but i am not successful, so we just get it here, Node/Express needs more documentation
        url: window.location.href
    });
}

/**
 * Source:  View
 * Handles: When a user likes to join an existing game
 * Data:    gameId, playerName
 */
function onViewJoinGame(data) {
    socket.emit(IOEvents.PLAYER_JOIN, data);
}

/**
 * Source:  Socket.IO
 * Handles: When the server says the player has joined the game
 * Data:    success, gameId, playerId, playerName
 */
function onPlayerJoined(data) {
    if (data.success) {
        if (game.isCreated) {
            // we are the one creating the game so the player who joins is our opponent
            game.opponentName = sanitizeHtml(data.playerName);
            gameView.playerJoined(true);
            game.generatePieces();
            gameView.createGamePieces();
        } else {
            // we are joining this existing game
            game.init(data.gameId, data.playerId, sanitizeHtml(data.playerName));
            game.opponentName = sanitizeHtml(data.opponentName);
            // we did not create this game, we joined this game
            game.isCreated = false;
            // update the view
            gameView.show(function() {
                gameView.playerJoined(false);
                // let's prepare our game pieces
                game.generatePieces();
                gameView.createGamePieces();
            });
        }
    } else {
        msgbox.show(data.error);
    }
}

/**
 * Source:  View
 * Handles: When a user clicks the ready button (submits his/her game pieces)
 * Data:    gameId, playerId, gamePieces(Array)
 */
function onViewSubmitPieces(data) {
    socket.emit(IOEvents.SUBMIT_PIECES, data);
}

/**
 * Source:  Socket.IO
 * Handles: When the pieces have been submitted to the server
 * Data:    success, playerId, gamePieces(position and hash codes only), isStarted
 */
function onPiecesSubmitted(data) {
    if (data.success) {
        game.hasStarted = data.isStarted;
        gameView.gamePiecesSubmitted(data.playerId, data.gamePieces, data.isStarted);
        // if the game has started, wait for the first player's move
        if (data.isStarted) {
            chatView.init();
            if (game.isCreated) {
                gameView.waitPlayersTurn();
            } else {
                gameView.waitForOpponentsTurn();
            }
        }
    } else {
        msgbox.show(data.error);
    }
}

/**
 * Source:  View
 * Handles: When a game piece is selected
 * Data:    gameId, position
 */
function onViewGamePieceSelected(data) {
    socket.emit(IOEvents.PIECE_SELECTED, data);
}

/**
 * Source:  Socket.IO
 * Handles: When the opponent has selected a game piece
 * Data:    position
 */
function onOpponentGamePieceSelected(data) {
    gameView.onOpponentGamePieceSelected(data.position);
}

/**
 * Source:  Socket.IO
 * Handles: When the player has taken turn
 * Data:    success, playerId, result
 */
function onPlayerTakesTurn(data) {
    if (data.success) {
        // let's inform the view that the move is valid
        gameView.onGamePieceMovedOrChallenged(data.result)
                .done(function() {
                    if (data.isGameOver) {
                        // the current player is the winner
                        gameView.showGameOver(data);
                    } else {
                        // get the next turn
                        if (data.playerId == game.playerId) {
                            gameView.waitPlayersTurn();
                        } else {
                            gameView.waitForOpponentsTurn();
                        }
                    }
                });
    } else {
        msgbox.show(data.error);
    }
}

function onViewMovesGamePiece(data) {
    socket.emit(IOEvents.PLAYER_TAKES_TURN, data);
}

/**
 * Source:  Socket.IO
 * Handles: A player has left the game by closing his browser
 *          or navigating to another address
 */
function onPlayerLeft() {
    msgbox.show('Your opponent has left the game. This game is over.', function() {
        window.location.href = window.location.href;
    });
}

/**
 * Source:  View
 * Handles: When a user chats a message
 */
function onSendChatMessage(message) {
    socket.emit(IOEvents.CHAT_MESSAGE, {
        gameId: game.id,
        playerId: game.playerId,
        message: message
    });
}

/**
 * Handles: IOEvents.CHAT_MESSAGE
 * Emits:   IOEvents.CHAT_MESSAGE
 * data:    gameId, playerId, message
 */
function onRecieveChatMessage(data) {
    chatView.addMessage(data.playerId == game.playerId ? game.playerName : game.opponentName, data.message);
}

/**
 * Utility function to clean HTML inputs
 */
function sanitizeHtml(string) {
    sanitizeHtml.span = sanitizeHtml.span || $('<span/>');
    return sanitizeHtml.span.text(string).html();
}

})();