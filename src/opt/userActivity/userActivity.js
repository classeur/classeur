angular.module('classeur.opt.userActivity', [])
	.directive('clUserActivity', function($window, $timeout, $rootScope, clUserInfoSvc, clEditorSvc, clSyncSvc) {
		var colors = [
			'F15D45',
			'EF4A53',
			'EE3661',
			'E03171',
			'C73080',
			'AA358E',
			'8B3E98',
			'6E499D',
			'5255A5',
			'2F64AF',
			'0076BD',
			'0088C2',
			'009ABD',
			'00A6AD',
			'00AE98',
			'08B180',
			'29B56C',
			'61BD5C',
			'8FC84D',
			'B8C941',
			'D9BD36',
			'EEA830',
			'F68E32',
			'F3733B'
		];
		var styleElt = $window.document.createElement('style');
		styleElt.type = 'text/css';
		$window.document.getElementsByTagName('head')[0].appendChild(styleElt);
		var userClasses = {};

		function refreshClasses() {
			var styleContent = '';
			angular.forEach(userClasses, function(userClass, userId) {
				styleContent += '.user-activity-' + userId + ' {';
				styleContent += '-webkit-box-shadow: inset -2px 0 0 1px #' + userClass.color + ';';
				styleContent += 'box-shadow: inset -2px 0 0 1px #' + userClass.color + '}';
				var userInfo = clUserInfoSvc.users[userId];
				var escapedUsername = ((userInfo && userInfo.name) || userId).replace(/[\s\S]/g, function(character) {
					var escape = character.charCodeAt().toString(16);
					return '\\' + ('000000' + escape).slice(-6);
				});
				styleContent += '.user-activity-' + userId + '::after {';
				styleContent += 'color: #' + userClass.color + ';';
				styleContent += 'content: \'' + escapedUsername + '\';';
			});
			styleElt.innerHTML = styleContent;
		}

		function createUserClass(userId) {
			if (!userClasses.hasOwnProperty(userId)) {
				userClasses[userId] = {
					color: colors[Math.random() * colors.length | 0]
				};
				refreshClasses();
			}
		}

		$rootScope.$watch('userInfoSvc.lastUserInfo', refreshClasses);

		var Marker = window.cledit.Marker;

		return {
			restrict: 'E',
			link: function(scope) {
				createUserClass(scope.userId);
				var timeoutId;
				var rangyRange;
				var highlightedOffset;
				var startMarker, endMarker;
				// Live collection
				var className = 'user-activity-' + scope.userId;
				var userActivityElts = clEditorSvc.editorElt.getElementsByClassName(className);

				function setHighlighting() {
					var start = startMarker.offset;
					var end = endMarker.offset;
					var content = clEditorSvc.cledit.getContent();
					while (end && content[end - 1] === '\n') {
						end--;
					}
					if (start >= end) {
						start = end ? end - 1 : end;
					}
					content = content.substring(start, end);
					start += content.lastIndexOf('\n') + 1;
					if (start === end) {
						return;
					}
					startMarker = new Marker(start);
					endMarker = new Marker(end);
					clEditorSvc.cledit.addMarker(startMarker);
					clEditorSvc.cledit.addMarker(endMarker);
					var range = clEditorSvc.cledit.selectionMgr.createRange(startMarker.offset, endMarker.offset);
					// Create rangy range
					rangyRange = $window.rangy.createRange();
					rangyRange.setStart(range.startContainer, range.startOffset);
					rangyRange.setEnd(range.endContainer, range.endOffset);
					var classApplier = $window.rangy.createClassApplier(className, {
						elementProperties: {
							className: 'user-activity'
						},
						tagNames: ['span'],
						normalize: false
					});
					classApplier.applyToRange(rangyRange);
					// Keep only one span
					var undoElt;
					Array.prototype.slice.call(userActivityElts).forEach(function(elt) {
						if (undoElt) {
							undoElt.classList.remove(className);
						}
						undoElt = elt;
					});
					clEditorSvc.cledit.selectionMgr.restoreSelection();
				}

				function unsetHighlighting() {
					startMarker && clEditorSvc.cledit.removeMarker(startMarker);
					endMarker && clEditorSvc.cledit.removeMarker(endMarker);
					Array.prototype.slice.call(userActivityElts).forEach(function(elt) {
						elt.classList.remove(className);
					});
				}

				function highlightOffset(offset) {
					$timeout.cancel(timeoutId);
					unsetHighlighting();
					highlightedOffset = offset;
					if (!offset) {
						return;
					}
					startMarker = new Marker(offset.start);
					endMarker = new Marker(offset.end);
					setHighlighting();
					timeoutId = $timeout(function() {
						if (clSyncSvc.watchCtx) {
							delete clSyncSvc.watchCtx.userActivities[scope.userId];
						}
					}, 30000);
				}
				scope.$watch('userActivity.offset', highlightOffset);

				function restoreHighlighting() {
					if (highlightedOffset === scope.userActivity.offset && !rangyRange.isValid()) {
						unsetHighlighting();
						setHighlighting();
					}
				}

				clEditorSvc.cledit.on('contentChanged', restoreHighlighting);

				scope.$on('$destroy', function() {
					unsetHighlighting();
					clEditorSvc.cledit.off('contentChanged', restoreHighlighting);
				});
			}
		};
	});
