angular.module('classeur.extensions.stat', [])
	.directive('clStat', function(editor, panel, selectionListener) {
		function Stat(name, regex) {
			this.name = name;
			this.regex = new RegExp(regex, 'gm');
		}

		var markdownStats = [
			new Stat('bytes', '[\\s\\S]'),
			new Stat('words', '\\S+'),
			new Stat('lines', '\n'),
		];

		var htmlStats = [
			new Stat('characters', '\\S'),
			new Stat('words', '\\S+'),
			new Stat('paragraphs', '\\S.*\n'),
		];

		var Hammer = window.Hammer;
		return {
			restrict: 'E',
			scope: true,
			templateUrl: 'app/extensions/stat/stat.html',
			link: function(scope, element) {
				scope.markdownStats = markdownStats;
				scope.htmlStats = htmlStats;
				scope.editor = editor;
				scope.selectionListener = selectionListener;

				var x = 0, y = -130;
				var statPanel = panel(element, '.stat.panel');
				statPanel.move().rotate(-1.5)
					.then().to(x, y).duration(180).ease('ease-out-back').pop()
					.end();

				var hammertime = new Hammer(element[0]);
				hammertime.get('pan').set({ direction: Hammer.DIRECTION_ALL, threshold: 0 });
				hammertime.on('panmove', function(evt) {
					evt.preventDefault();
					statPanel.move().rotate(-1.5).to(x + evt.deltaX, y + evt.deltaY).end();
				});
				hammertime.on('panend', function(evt) {
					x += evt.deltaX;
					y += evt.deltaY;
				});

				function computeMarkdown() {
					scope.isMarkdownSelection = false;
					var text = editor.cledit.getContent();
					var selectedText = editor.cledit.selectionMgr.getSelectedText();
					if(selectedText) {
						scope.isMarkdownSelection = true;
						text = selectedText;
					}
					markdownStats.forEach(function(stat) {
						stat.value = (text.match(stat.regex) || []).length;
					});
				}

				function computeHtml() {
					var text;
					if(selectionListener.range &&
						(editor.previewElt.compareDocumentPosition(selectionListener.range.startContainer) & Node.DOCUMENT_POSITION_CONTAINED_BY) &&
						(editor.previewElt.compareDocumentPosition(selectionListener.range.endContainer) & Node.DOCUMENT_POSITION_CONTAINED_BY)) {
						text = '' + selectionListener.range;
					}
					if(text) {
						scope.isHtmlSelection = true;
					}
					else {
						scope.isHtmlSelection = false;
						text = editor.previewText;
					}
					htmlStats.forEach(function(stat) {
						stat.value = (text.match(stat.regex) || []).length;
					});
				}

				scope.$watch('editor.sectionList', computeMarkdown);
				scope.$watch('editor.selectionRange', computeMarkdown);
				scope.$watch('editor.previewText', computeHtml);
				scope.$watch('selectionListener.range', computeHtml);
			}
		};
	})
	.factory('selectionListener', function($timeout) {
		var selectionListener = {};
		function saveSelection() {
			$timeout(function() {
				var selection = window.getSelection();
				selectionListener.range = selection.rangeCount && selection.getRangeAt(0);
			}, 25);
		}
		window.addEventListener('keyup', saveSelection);
		window.addEventListener('mouseup', saveSelection);
		window.addEventListener('contextmenu', saveSelection);
		return selectionListener;
	});
