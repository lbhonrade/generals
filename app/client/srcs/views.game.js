/**
 * The game view object which wraps UI interaction with the game view
 */
TGO.Views.gameView = (function() {

    // our game view needs to publish events
    var view = new TGO.Models.EventEmitter();

    // just a local reference to our game object
    // useful for minification as well as long typing
    var game = TGO.Models.game;

    // the following are jQuery objects which represents different DOM
    // elements that will be updated upon game state changes
    var message, gameId, fallenPieces;
    // some user action buttons to
    //      submit the game pieces (readyButton)
    //      play the game again (newGameButton)
    var readyButton, newGameButton;
    // and our game board jQuery object
    var gameBoard;
    // flag that controls whether the player con move his game pieces or not
    var isGameBoardLocked = false;
    // flag that controls whether the view is animating something
    var isAnimating = false;
    // flag that controls whether any player has made a single move
    // or basically if the game has actually started
    var hasStarted = false;

    /**
     * Initializes our jQuery view objects
     * These view objects are not yet present when we are at the welcome page
     * so jquery can't find them until this view has been loaded from the template
     */
    function init() {
        message = $('.game-message');
        gameId = $('.game-id');
        gameId.on('click', function() {
            $(this).select();
        });
        // let's build the game board
        gameBoard = $('#game-board');
        var tbody = $('<tbody></tbody>');
        for (var i = 0; i < 8; i++) {
            tbody.append('<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>')
        }
        gameBoard.append(tbody);
        // where we place our fallen pieces
        fallenPieces = $('#fallen-pieces');
        // this is not in the dom yet, we only add it when we are ready to submit game pieces
        readyButton = $('#ready');
        readyButton.on('click', onReadyButtonClick);
        // used to play again when the game is over
        newGameButton = $('#new-game');
        newGameButton.on('click', function(e) {
            e.stopPropagation();
            window.location.reload();
        });
        // TODO: add view cheat sheet button click
        viewCheatSheetButton = $('#view-cheat-sheet');
        viewCheatSheetButton.on('click', function(e) {
            e.stopPropagation();
            TGO.Views.utils.openSmallWindow('/cs.html', 'TGO');
        });

        // and finally attach our delegated events for the game pieces
        var doc = $(document);
        doc.delegate('.content', 'click', clearSelectionStyles);
        doc.delegate('.game-piece', 'click', onGamePieceSelected);
        doc.delegate('#game-board', 'contextmenu', onGamePieceMoved);
    }

    /**
     * Changes the main message for player
     * @param {String} msg The message that can be string or HTML
     */
    function setGameMessage(msg) {
        var callback = null;
        var args = Array.prototype.slice.call(arguments, 0);
        if (typeof args[args.length - 1] == 'function') {
            callback = args.pop();
        }
        // first, replace placeholders and translate this text
        msg = TGO.Views.utils.i18n.apply(null, args);
        // show this message
        TGO.Views.utils.fadeToView(message, msg, callback);
    }

    /**
     * This function is called when the game has been successfully created.
     * @param  {Object} _game The game object
     */
    function onGameCreated() {
        gameId.val(game.id);
        setGameMessage('WELCOME %s! Copy game ID below and send it to your opponent.', game.playerName, game.id);
    }

    /**
     * This function is called when a player has joined the game successfully
     * and also let's give them the button to submit their game pieces (readyButton)
     */
    function onPlayerJoined() {

        if (game.isCreated) {
            setGameMessage('%s connected. ARRANGE your pieces then click on the <u>SUBMIT GAME PIECES</u> button.',
                game.opponentName);
        } else {
            setGameMessage('WELCOME %s! ARRANGE your game pieces then click on the SUBMIT GAME PIECES button.',
                game.playerName, game.opponentName);
        }

        readyButton.show();
        gameId.val(game.id);
        initGameBoardPositions();
    }

    /**
     * Both players will have different start and end positions
     * for their game pieces because obviously they share the same
     * board and we need to take that into account
     *
     * We are also adding an "initialized" class to all boxes that
     * belong to a players "territory" so that we can style those
     * boxes when the user arranges his/her game pieces
     */
    function initGameBoardPositions() {
        if (game.isCreated) {
            var row = 9, column = 0, position = 0, td;
            while (row > 0) {
                if (column == 0) {
                    row--;
                    column = 9;
                }
                td = gameBoard
                    .find('tr:nth-child(' + row + ') td:nth-child(' + column + ')')
                    // so we can easily find a TD element
                    .attr('data-pos', position)
                    // so we can easily refer the position value programmatically
                    .data('position', position);
                if (row > 5) {
                    td.addClass('initialized');
                }
                column--;
                position++;
            }
        } else {
            var row = 1, column = 1, position = 0;
            while (row < 9) {
                if (column > 9) {
                    row++;
                    column = 1;
                }
                td = gameBoard
                    .find('tr:nth-child(' + row + ') td:nth-child(' + column + ')')
                    // so we can easily find a TD element
                    .attr('data-pos', position)
                    // so we can easily refer the position value programmatically
                    .data('position', position);
                if (row > 5) {
                    td.addClass('initialized');
                }
                column++;
                position++;
            }
        }
    }

    /**
     * This function is called when the game object has successfully created
     * the game pieces for the current player. We then add the game pieces
     * to the game board.
     */
    function onGamePiecesCreated() {
        var gamePieces = [];
        for (var i = 0, j = game.pieces.length; i < j; i++) {
            gamePieces.push(createGamePiece(game.pieces[i]));
        }
        addGamePiecesToBoard(gamePieces);
    }

    /**
     * Add an array of game pieces jQuery object elements to the game board
     * @param {Array} gamePieces An array of game pieces jquery objects
     */
    function addGamePiecesToBoard(gamePieces) {
        while (gamePieces.length) {
            var gamePiece = gamePieces.pop();
            gameBoard.find('td[data-pos="' + gamePiece.data('init-pos') + '"]')
                     .append(gamePiece);
            // now remove the position since it will become useless
            // we refer to the parent position from now on
            gamePiece.removeData('init-pos');
        }
    }

    /**
     * Create a jQuery game piece object
     * @param  {Object} piece The game piece data
     * @return {jQuery}       The jQuery object representing the game piece
     */
    function createGamePiece(piece) {
        // this is the containing jQuery object of this game piece
        var element = $('<div>');

        // add the classes for styling this piece object
        element.addClass('game-piece');

        // okay, we assume this is an opponent's game piece
        // since we are not given the code/rank
        if (!piece.code) {
            element.addClass('opponent');
        } else {
            element.addClass('game-piece-' + piece.code);
            element.html('<span class="code">' + piece.code + '</span>');
        }

        // set our initial position so it can be added in the board
        element.data('init-pos', piece.position);
        return element;
    }

    /**
     * Handles the event when the ready button was clicked
     */
    function onReadyButtonClick(e) {
        e.stopPropagation();

        // then we are ready to submit our game pieces
        view.emit(TGO.Views.Events.SUBMIT_PIECES, {
            gameId: game.id,
            playerId: game.playerId,
            gamePieces: getGamePiecesOnBoard()
        });

        readyButton.hide();
    }

    /**
     * Get the game pieces on the board for submission
     * NO opponent game pieces should be included if available
     * @return {Array} The game pieces
     */
    function getGamePiecesOnBoard() {
        var pieces = [];
        gameBoard.find('.game-piece').not('.opponent').each(function(index, element) {
            pieces.push(game.getPiece($(element).parent().data('pos')));
        });
        return pieces;
    }

    /**
     * This function is called once we have submitted the game pieces successfully
     * @param  {String} playerId  The player who submitted the game pieces
     * @param  {Array}  positions An array of integer positions of the submitted pieces
     *                            The codes/ranks are not given of course
     */
    function onGamePiecesSubmitted(playerId, positions, isStarted) {
        // if we are the player who submits it
        if (game.playerId == playerId) {
            setGameMessage('Game pieces submitted. Waiting for %s.', game.opponentName);
        } else {
            if (!isStarted) {
                setGameMessage('%s has submitted his/her game pieces.', game.opponentName);
                // allow the user submit game pieces
                readyButton.show();
            }

            // if not then we need to get those game piece positions in our board
            var gamePieces = [];
            for (var i = 0; i < positions.length; i++) {
                gamePieces.push(createGamePiece({
                    position: positions[i]
                }));
            }
            addGamePiecesToBoard(gamePieces);
        }
    }

    function waitPlayersTurn() {
        setGameMessage('YOUR TURN!');
        isGameBoardLocked = false;

        // now we have started
        hasStarted = true;
        clearSelectionStyles();
    }

    function waitForOpponentsTurn() {
        setGameMessage('Waiting for %s\'s move. Please wait.', game.opponentName);
        isGameBoardLocked = true;

        // now we have started
        hasStarted = true;
        clearSelectionStyles();
    }

    function clearSelectionStyles() {
        // remove all game piece selection style
        gameBoard.find('.game-piece').removeClass('selected');
        // remove all hint styles
        gameBoard.find('td').removeClass('challengeable')
                            .removeClass('possible-move');
        if (hasStarted) {
            // and if we have already submitted our pieces,
            // then we don't need anymore the initialized style
            gameBoard.find('td').removeClass('initialized');
        }
    }

    function highlightPossibleMoves(gamePiece) {
        var oldPos = gamePiece.parent().data('pos');
        var oldRow = Math.floor(oldPos / 9);

        // top and bottom
        highlightGamePieceContainer(gameBoard.find('td[data-pos="' + (oldPos + 9) + '"]'));
        highlightGamePieceContainer(gameBoard.find('td[data-pos="' + (oldPos - 9) + '"]'));
        // left and still on the same row
        if (oldRow == Math.floor((oldPos + 1) / 9)) {
            highlightGamePieceContainer(gameBoard.find('td[data-pos="' + (oldPos + 1) + '"]'));
        }
        // right and still on the same row
        if (oldRow == Math.floor((oldPos - 1) / 9)) {
            highlightGamePieceContainer(gameBoard.find('td[data-pos="' + (oldPos - 1) + '"]'));
        }
    }

    function highlightGamePieceContainer(container) {
        if (container.length === 0) {
            // ooppsss, box is outside the game board
            return;
        }
        // okay, a valid board box but let's check if
        // we already have an existing game piece there
        // that is an opponent's game piece
        if (container.find('.game-piece.opponent').length) {
            // the let's add a "challengeable" style
            // which is only triggered when the player hovers
            // his/her mouse over this TD element
            container.addClass('challengeable');
        } else if (container.find('.game-piece').length == 0) {
            // no one's here so let's style this container
            container.addClass('possible-move');
        }
    }

    /**
     * Handles the event when the user clicks on a game piece
     */
    function onGamePieceSelected(e) {
        e.stopPropagation();
        var gamePiece = $(this);

        // we can't select anything if we are in the first two states
        // and we can't select an opponent's game piece
        if (isGameBoardLocked ||
            isAnimating ||
            gamePiece.hasClass('opponent')) {
            return;
        }

        // clear all selections
        clearSelectionStyles();
        // add our selection styling
        gamePiece.addClass('selected');
        // and if the game has already started,
        // then we should show the user all the possible
        // moves including possible challenges
        if (hasStarted) {
            highlightPossibleMoves(gamePiece);
        }
    }

    /**
     * Handles the event where the user right clicks
     * the gameboard or a game piece to swap/challenge
     */
    function onGamePieceMoved(e) {
        e.stopPropagation();
        // stop the context menu as well
        e.preventDefault();

        // no user move is allowed at these states
        if (isGameBoardLocked || isAnimating) {
            return;
        }

        var gamePiece = gameBoard.find('.game-piece.selected');
        // if we don't have a selected game piece, then nothing's to be moved
        if (gamePiece.length == 0) {
            return;
        }

        var newParent = $(e.target);
        // let's make sure this is a td
        while (newParent.prop('tagName') != 'TD') {
            newParent = newParent.parent();
        }
        // if the parent is not a target parent, then we should not
        // allow this move although it will still be validated in
        // the server, this is for better user experience and lessen
        // network calls/latencies
        if (hasStarted &&
            !newParent.hasClass('possible-move') &&
            !newParent.hasClass('challengeable')) {
            return;
        }

        // if the game has started then we should show possible moves and challenges
        if (hasStarted) {

            // now let's see if we can really move a piece
            // or challenge an opponent's piece
            // NOTE: these client side validation is not foolproof
            //       so we also have server side validation (no cheating)
            view.emit(TGO.Views.Events.TAKE_TURN, {
                gameId: game.id,
                playerId: game.playerId,
                oldPosition: gamePiece.parent().data('pos'),
                newPosition: newParent.data('pos')
            });


        // or if we are still arranging the piece items, then we are free to move
        // our game pieces anywhere within our "bounderies"
        } else {

            // prevent moves outside the player's bounderies
            // and clear the selection
            if ( game.isCreated && newParent.data('pos') > 26 ||
                !game.isCreated && newParent.data('pos') < 45) {
                clearSelectionStyles();
                return;
            }

            // before we move, let's see first if
            // there is already a piece on the new parent
            var currentParent = gamePiece.parent();
            var newParentChild = newParent.find('.game-piece');

            // let's move/swap game pieces
            isAnimating = true;

            // first, since we may be swapping game pieces,
            // we can't use moveGamePiece() here
            // because it will just lead to a cyclic move
            // let's update our data first
            var piece1 = game.getPiece(currentParent.data('pos'));
            var piece2 = game.getPiece(newParent.data('pos'));
            piece1.position = newParent.data('pos');
            if (piece2) {
                piece2.position = currentParent.data('pos');
            }
            // then the animations
            currentParent.addClass('target');
            newParent.addClass('target');
            // let's track if both animations are done
            // because we want to do "something" after both
            // are done, we will NOT know who will finish first
            // so we do this
            var animationCount = 0;
            TGO.Views.utils.moveElementAnim(gamePiece, newParent, function() { animationCount++; });
            TGO.Views.utils.moveElementAnim(newParentChild, currentParent, function() { animationCount++; });
            // then, we do that "something" here
            (function afterAnim() {
                if (animationCount == 2) {
                    // remove our styling class since we are done
                    currentParent.removeClass('target');
                    newParent.removeClass('target');
                    // and allow other things to happen
                    isAnimating = false;
                } else {
                    setTimeout(afterAnim, 200);
                }
            })();
        }
    }

    function moveGamePiece(gamePiece, newParent) {
        // prevent other user moves
        isAnimating = true;
        // add some styling to our target newParent
        newParent.addClass('target');
        // get the old and new positions
        var oldPos = gamePiece.parent().data('pos');
        var newPos = newParent.data('pos');

        TGO.Views.utils.moveElementAnim(gamePiece, newParent, function() {
            // remove our styling class since we are done
            newParent.removeClass('target');
            // update the game piece's position (except an opponent since we don't have them)
            var piece =  game.getPiece(oldPos);
            if (piece) {
                piece.position = newPos;
            }
            // and allow other things to happen
            isAnimating = false;
        });
    }

    function throwGamePiece(gamePiece) {
        var piece = TGO.Models.game.getPiece(gamePiece.parent().data('pos'));
        if (piece) {
            piece.position = -1;
        }
        // if this is your game piece, then we will show it in the fallen pieces list
        // but if an opponent, remove it from the board
        if (gamePiece.hasClass('opponent')) {
            gamePiece.remove();
        } else {
            isAnimating = true;
            TGO.Views.utils.moveElementAnim(gamePiece, fallenPieces, function() {
                gamePiece.removeClass('selected');
                isAnimating = false;
            });
        }
    }

    /**
     * Moves the game piece after validated by the server
     * @param {Object} moveResult The result object based from the server
     */
    function onGamePieceMovedOrChallenged(moveResult) {
        var gamePiece = gameBoard.find('td[data-pos="' + moveResult.oldPosition + '"] .game-piece');
        var newParent = gameBoard.find('td[data-pos="' + moveResult.newPosition + '"]');

        if (moveResult.isChallenge) {
            // for the current player, you might be the referred opponentPiece
            var opponentPiece = newParent.find('.game-piece');
            if (moveResult.challengeResult == 1) {
                throwGamePiece(opponentPiece);
                moveGamePiece(gamePiece, newParent);
            } else if (moveResult.challengeResult == 0) {
                throwGamePiece(opponentPiece);
                throwGamePiece(gamePiece);
            } else {
                throwGamePiece(gamePiece);
                moveGamePiece(opponentPiece, newParent);
            }
        } else {
            moveGamePiece(gamePiece, newParent);
        }
        clearSelectionStyles();
    }

    function showGameOver(data) {
        if (data.playerId) {
            if (data.is30MoveRule) {
                if (data.playerId == game.playerId) {
                    setGameMessage('YOU WIN BY THE 30-MOVE RULE!');
                } else {
                    setGameMessage('YOU LOSE BY THE 30-MOVE RULE!');
                }
            } else {
                if (data.playerId == game.playerId) {
                    setGameMessage('YOU WIN!');
                } else {
                    setGameMessage('YOU LOSE!');
                }
            }
        } else {
            setGameMessage('THIS BOUT IS A DRAW BY THE 30-MOVE RULE!');
        }

        // then, let's reveal all the opponent pieces
        for (var i = 0; i < data.pieces.length; i++) {
            if (data.pieces[i].position != -1) {
                var gamePiece = gameBoard.find('td[data-pos="' + data.pieces[i].position + '"] .game-piece');
                if (gamePiece.hasClass('opponent')) {
                    gamePiece.addClass('game-piece-' + data.pieces[i].code);
                    gamePiece.html('<span class="code">' + data.pieces[i].code + '</span>');
                }
            }
        }

        isGameBoardLocked = true;
    }

    // public API
    view.init = init;
    view.onGameCreated = onGameCreated;
    view.onPlayerJoined = onPlayerJoined;
    view.onGamePiecesCreated = onGamePiecesCreated;
    view.onGamePiecesSubmitted = onGamePiecesSubmitted;
    view.waitPlayersTurn = waitPlayersTurn;
    view.waitForOpponentsTurn = waitForOpponentsTurn;
    view.onGamePieceMovedOrChallenged = onGamePieceMovedOrChallenged;
    view.showGameOver = showGameOver;

    return view;

})();
