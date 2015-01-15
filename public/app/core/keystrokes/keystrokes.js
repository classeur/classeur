angular.module('classeur.core.keystrokes', [])
	.factory('clKeystrokeSvc', function() {
		var Keystroke = window.cledit.Keystroke;
		var indentRegexp = /^ {0,3}>[ ]*|^[ \t]*(?:[*+\-]|(\d+)\.)[ \t]|^\s+/;
		var clearNewline;

		return function(clEditorSvc) {

			function addPagedownKeystroke(keyCodeChar, name) {
				clEditorSvc.cledit.addKeystroke(name, new Keystroke(function(evt) {
					if((!evt.ctrlKey && !evt.metaKey) || evt.altKey) {
						return;
					}
					var keyCode = evt.charCode || evt.keyCode;
					if(String.fromCharCode(keyCode).toLowerCase() === keyCodeChar) {
						clEditorSvc.pagedownEditor.uiManager.doClick(name);
						evt.preventDefault();
						return true;
					}
				}));
			}

			addPagedownKeystroke('b', 'bold');
			addPagedownKeystroke('i', 'italic');
			addPagedownKeystroke('l', 'link');
			addPagedownKeystroke('q', 'quote');
			addPagedownKeystroke('k', 'code');
			addPagedownKeystroke('g', 'image');
			addPagedownKeystroke('o', 'olist');
			addPagedownKeystroke('u', 'ulist');
			addPagedownKeystroke('h', 'heading');
			addPagedownKeystroke('r', 'hr');

			clEditorSvc.cledit.addKeystroke('indent', new Keystroke(function(evt, state) {
				if(evt.which !== 9 || evt.metaKey || evt.ctrlKey) {
					// Not tab
					return;
				}

				function strSplice(str, i, remove, add) {
					remove = +remove || 0;
					add = add || '';
					return str.slice(0, i) + add + str.slice(i + remove);
				}

				evt.preventDefault();
				var isInverse = evt.shiftKey;
				var lf = state.before.lastIndexOf('\n') + 1;
				if(isInverse) {
					if(/\s/.test(state.before.charAt(lf))) {
						state.before = strSplice(state.before, lf, 1);

						state.selectionStart--;
						state.selectionEnd--;
					}
					state.selection = state.selection.replace(/^[ \t]/gm, '');
				}
				else {
					var previousLine = state.before.slice(lf);
					if(state.selection || previousLine.match(indentRegexp)) {
						state.before = strSplice(state.before, lf, 0, '\t');
						state.selection = state.selection.replace(/\r?\n(?=[\s\S])/g, '\n\t');
						state.selectionStart++;
						state.selectionEnd++;
					} else {
						state.before += '\t';
						state.selectionStart++;
						state.selectionEnd++;
						return true;
					}
				}
				state.selectionEnd = state.selectionStart + state.selection.length;
				return true;
			}));

			clEditorSvc.cledit.addKeystroke('newline', new Keystroke(function(evt, state) {
				if(evt.which !== 13) {
					// Not enter
					clearNewline = false;
					return;
				}

				evt.preventDefault();
				var lf = state.before.lastIndexOf('\n') + 1;
				if(clearNewline) {
					state.before = state.before.substring(0, lf);
					state.selection = '';
					state.selectionStart = lf;
					state.selectionEnd = lf;
					clearNewline = false;
					return true;
				}
				clearNewline = false;
				var previousLine = state.before.slice(lf);
				var indentMatch = previousLine.match(indentRegexp);
				var indent = (indentMatch || [''])[0];
				if(indentMatch && indentMatch[1]) {
					var number = parseInt(indentMatch[1], 10);
					indent = indent.replace(/\d+/, number + 1);
				}
				if(indent.length) {
					clearNewline = true;
				}

				clEditorSvc.cledit.undoMgr.setCurrentMode('single');

				state.before += '\n' + indent;
				state.selection = '';
				state.selectionStart += indent.length + 1;
				state.selectionEnd = state.selectionStart;
				return true;
			}));
		};
	});
