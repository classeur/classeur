angular.module('classeur.core.keystrokes', [])
	.factory('clKeystrokeSvc',
		function($window) {
			var Keystroke = $window.cledit.Keystroke,
				indentRegexp = /^ {0,3}>[ ]*|^[ \t]*[*+\-][ \t]|^([ \t]*)\d+\.[ \t]|^\s+/,
				clearNewline,
				lastSelection;

			function fixNumberedList(state, indent) {
				if (state.selection || indent === undefined) {
					return;
				}
				var indentRegex = new RegExp('^' + indent + '(\\d+\.[ \\t])?(.*)$|^[ \\s]*$');
				var num = 0;

				function formatLine(line) {
					var match = line.match(indentRegex);
					if (!match) {
						num = 0;
					} else if (match[1]) {
						line = indent + (++num) + match[1].slice(-2) + match[2];
					}
					return line;
				}
				state.before = state.before.split('\n').map(formatLine).join('\n');
				state.after = state.after.split('\n');
				var currentLine = state.after.shift();
				state.after = currentLine + '\n' + state.after.map(formatLine).join('\n');
			}

			return function(clEditorSvc) {

				function addPagedownKeystroke(keyCodeChar, name) {
					clEditorSvc.cledit.addKeystroke(50, new Keystroke(function(evt) {
						if ((!evt.ctrlKey && !evt.metaKey) || evt.altKey) {
							return;
						}
						var keyCode = evt.charCode || evt.keyCode;
						if (String.fromCharCode(keyCode).toLowerCase() === keyCodeChar) {
							setTimeout(function() {
								clEditorSvc.pagedownEditor.uiManager.doClick(name);
							}, 1);
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

				clEditorSvc.cledit.addKeystroke(50, new Keystroke(function(evt, state) {
					if (evt.which !== 9 || evt.metaKey || evt.ctrlKey) {
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
					if (isInverse) {
						if (/\s/.test(state.before.charAt(lf))) {
							state.before = strSplice(state.before, lf, 1);
							state.selectionStart--;
							state.selectionEnd--;
						}
						state.selection = state.selection.replace(/^[ \t]/gm, '');
					} else {
						var previousLine = state.before.slice(lf);
						var indentMatch = previousLine.match(indentRegexp);
						if (state.selection || indentMatch) {
							state.before = strSplice(state.before, lf, 0, '\t');
							state.selection = state.selection.replace(/\n(?=.)/g, '\n\t');
							state.selectionStart++;
							state.selectionEnd++;
							fixNumberedList(state, indentMatch[1]);
							fixNumberedList(state, '\t' + indentMatch[1]);
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

				clEditorSvc.cledit.addKeystroke(50, new Keystroke(function(evt, state) {
					if (evt.which !== 13) {
						// Not enter
						clearNewline = false;
						return;
					}

					evt.preventDefault();
					var lf = state.before.lastIndexOf('\n') + 1;
					var previousLine = state.before.slice(lf);
					var indentMatch = previousLine.match(indentRegexp);
					if (clearNewline && state.selectionStart === lastSelection && state.selectionEnd === lastSelection) {
						state.before = state.before.substring(0, lf);
						state.selection = '';
						state.selectionStart = lf;
						state.selectionEnd = lf;
						clearNewline = false;
						fixNumberedList(state, indentMatch[1]);
						return true;
					}
					clearNewline = false;
					var indent = (indentMatch || [''])[0];
					if (indent.length) {
						clearNewline = true;
					}

					clEditorSvc.cledit.undoMgr.setCurrentMode('single');

					state.before += '\n' + indent;
					state.selection = '';
					state.selectionStart += indent.length + 1;
					state.selectionEnd = state.selectionStart;
					lastSelection = state.selectionStart;
					fixNumberedList(state, indentMatch[1]);
					return true;
				}));
			};
		});
