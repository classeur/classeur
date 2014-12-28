angular.module('classeur.extensions.commenting', [])
	.directive('clCommentingGutter', function(commenting) {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/commenting/commentingGutter.html',
			scope: true,
			link: function(scope) {
				scope.commenting = commenting;

				var debouncedRefreshCoordinates = window.ced.Utils.debounce(function() {
					commenting.refreshCoordinates();
					scope.$apply();
				}, 10);

				scope.$watch('cledit.editorSize()', debouncedRefreshCoordinates);
				scope.$watch('cledit.sectionList', debouncedRefreshCoordinates);
			}
		};
	})
	.directive('clConversation', function($famous, commenting) {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/commenting/conversation.html',
			scope: true,
			link: function(scope) {
				var EventHandler = $famous['famous/core/EventHandler'];
				scope.commenting = commenting;
				scope.draggableHandler = new EventHandler();
			}
		};
	})
	.directive('clCommentInput', function() {
		return {
			restrict: 'E',
			template: '<md-text-float label="Comment" ng-model="newComment"> </md-text-float>',
			link: function(scope, element) {
				var inputElt = element[0].querySelector('input');
				inputElt.addEventListener('mousedown', function(e) {
					e.stopPropagation();
				});
				scope.$watch('commenting.currentDiscussion', function() {
					setTimeout(function() {
						inputElt.focus();
					}, 1);
				});
			}
		};
	})
	.factory('commenting', function(cledit) {
		var commentButtonHeight = 30;

		function CommentButton() {
			this.setTop(-commentButtonHeight);
		}

		var yList = [];

		CommentButton.prototype.setTop = function(top, isNew) {
			top = Math.round(top);
			var yListIndex = top - commentButtonHeight + 1;
			// Avoid overlap of comment icons
			while(yListIndex < top + commentButtonHeight) {
				if(yList[yListIndex]) {
					top = yListIndex + commentButtonHeight;
				}
				yListIndex++;
			}
			!isNew && (yList[top] = 1);
			this.top = (top - commentButtonHeight/2 + 1) + 'px';
		};

		function Discussion(selectionStart, selectionEnd, comments) {
			this.selectionStart = selectionStart;
			this.selectionEnd = selectionEnd;
			this.comments = comments;
			this.commentButton = new CommentButton();
		}

		var discussions = [
			new Discussion(10, 20, []),
			new Discussion(110, 120, []),
			new Discussion(110, 120, []),
		];
		function refreshCoordinates() {
			yList = [];
			discussions.sort(function(discussion1, discussion2) {
				return discussion1.selectionStart - discussion2.selectionStart;
			}).forEach(function(discussion) {
				var coordinates = cledit.editor.selectionMgr.getCoordinates(discussion.selectionStart);
				discussion.commentButton.setTop(coordinates.y);
			});
		}


		return {
			discussions: discussions,
			refreshCoordinates: refreshCoordinates
		};
	});
