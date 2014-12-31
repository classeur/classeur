angular.module('classeur.extensions.stat', [])
	.directive('clStat', function(editor) {
		function Stat(name, regex) {
			this.name = name;
			this.regex = new RegExp(regex, 'g');
		}

		var markdownStats = [
			new Stat('bytes', '.'),
			new Stat('lines', '.+'),
		];

		var htmlStats = [
			new Stat('characters', '\\S'),
			new Stat('words', '\\S+'),
			new Stat('paragraphs', '\\S.*'),
		];

		return {
			restrict: 'E',
			scope: true,
			templateUrl: 'app/extensions/stat/stat.html',
			link: function(scope) {
				scope.markdownStats = markdownStats;
				scope.htmlStats = htmlStats;
				scope.$watch('editor.sectionList', function() {
					var text = editor.cledit.getContent();
					markdownStats.forEach(function(stat) {
						stat.value = (text.match(stat.regex) || []).length;
					});
				});
				scope.$watch('editor.previewText', function(text) {
					htmlStats.forEach(function(stat) {
						stat.value = (text.match(stat.regex) || []).length;
					});
				});
			}
		};
	});
