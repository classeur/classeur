angular.module('classeur.optional.keystrokes', [])
	.directive('clKeystrokes',
		function($window, clEditorSvc) {
			var Keystroke = $window.cledit.Keystroke,
				indentRegexp = /^ {0,3}>[ ]*|^[ \t]*[*+\-][ \t]|^([ \t]*)\d+\.[ \t]|^\s+/,
				clearNewline,
				lastSelection;

			return {
				restrict: 'A',
				link: link
			};

			function link(scope) {
				scope.$watch('::editorSvc.cledit', function(cledit) {
					if (!cledit) {
						return;
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

					cledit.addKeystroke(new Keystroke(enterKeyHandler, 50));
					cledit.addKeystroke(new Keystroke(tabKeyHandler, 50));

					// Catch save dialog
					cledit.addKeystroke(new Keystroke(function(evt) {
						if ((!evt.ctrlKey && !evt.metaKey) || evt.altKey) {
							return;
						}
						var keyCode = evt.charCode || evt.keyCode;
						if (String.fromCharCode(keyCode).toLowerCase() === 's') {
							evt.preventDefault();
							return true;
						}
					}, 50));
				});
			}

			function addPagedownKeystroke(keyCodeChar, name) {
				clEditorSvc.cledit.addKeystroke(new Keystroke(function(evt) {
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
				}, 50));
			}

			function enterKeyHandler(evt, state) {
				if (evt.which !== 13) {
					// Not enter
					clearNewline = false;
					return;
				}

				evt.preventDefault();
				var lf = state.before.lastIndexOf('\n') + 1;
				var previousLine = state.before.slice(lf);
				var indentMatch = previousLine.match(indentRegexp) || [''];
				if (clearNewline && !state.selection && state.before.length === lastSelection) {
					state.before = state.before.substring(0, lf);
					state.selection = '';
					clearNewline = false;
					fixNumberedList(state, indentMatch[1]);
					return true;
				}
				clearNewline = false;
				var indent = indentMatch[0];
				if (indent.length) {
					clearNewline = true;
				}

				clEditorSvc.cledit.undoMgr.setCurrentMode('single');

				state.before += '\n' + indent;
				state.selection = '';
				lastSelection = state.before.length;
				fixNumberedList(state, indentMatch[1]);
				return true;
			}

			function tabKeyHandler(evt, state) {
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
				var previousLine = state.before.slice(lf) + state.selection + state.after;
				var indentMatch = previousLine.match(indentRegexp);
				if (isInverse) {
					if (/\s/.test(state.before.charAt(lf))) {
						state.before = strSplice(state.before, lf, 1);
						if (indentMatch) {
							fixNumberedList(state, indentMatch[1]);
							indentMatch[1] && fixNumberedList(state, indentMatch[1].slice(1));
						}
					}
					state.selection = state.selection.replace(/^[ \t]/gm, '');
				} else {
					if (state.selection || indentMatch) {
						state.before = strSplice(state.before, lf, 0, '\t');
						state.selection = state.selection.replace(/\n(?=.)/g, '\n\t');
						if(indentMatch) {
							fixNumberedList(state, indentMatch[1]);
							fixNumberedList(state, '\t' + indentMatch[1]);
						}
					} else {
						state.before += '\t';
					}
				}
				return true;
			}

			function fixNumberedList(state, indent) {
				if (state.selection || indent === undefined) {
					return;
				}
				var spaceIndent = indent.replace(/\t/g, '    ');
				var indentRegex = new RegExp('^[ \\s]*$|^' + spaceIndent + '(\\d+\.[ \\t])?(( )?.*)$');

				function getHits(lines) {
					var hits = [];
					var pendingHits = [];

					function flush() {
						if (pendingHits.hasHit || !pendingHits.hasNoIndent) {
							hits = hits.concat(pendingHits);
							pendingHits = [];
							return true;
						}
					}
					lines.cl_some(function(line) {
						var match = line.replace(/^[ \t]*/, function(wholeMatch) {
							return wholeMatch.replace(/\t/g, '    ');
						}).match(indentRegex);
						if (!match) {
							flush();
							return true;
						}
						pendingHits.push({
							line: line,
							match: match
						});
						if (match[2] !== undefined) {
							if (match[1]) {
								pendingHits.hasHit = true;
							} else if (!match[3]) {
								pendingHits.hasNoIndent = true;
							}
						} else if (!flush()) {
							return true;
						}
					});
					return hits;
				}

				function formatHits(hits) {
					var num;
					return hits.cl_map(function(hit) {
						if (hit.match[1]) {
							if (!num) {
								num = parseInt(hit.match[1]);
							}
							return indent + (num++) + hit.match[1].slice(-2) + hit.match[2];
						}
						return hit.line;
					});
				}
				var before = state.before.split('\n');
				var after = state.after.split('\n');
				var currentLine = before.pop() || '';
				var currentPos = currentLine.length;
				currentLine += after.shift() || '';
				var lines = before.concat(currentLine).concat(after);
				var idx = before.length - getHits(before.slice().reverse()).length; // Prevents starting from 0
				while (idx <= before.length + 1) {
					var hits = formatHits(getHits(lines.slice(idx)));
					if (!hits.length) {
						idx++;
					} else {
						lines = lines.slice(0, idx).concat(hits).concat(lines.slice(idx + hits.length));
						idx += hits.length;
					}
				}
				currentLine = lines[before.length];
				state.before = lines.slice(0, before.length);
				state.before.push(currentLine.slice(0, currentPos));
				state.before = state.before.join('\n');
				state.after = [currentLine.slice(currentPos)].concat(lines.slice(before.length + 1));
				state.after = state.after.join('\n');
			}
		});
