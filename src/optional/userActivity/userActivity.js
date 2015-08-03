angular.module('classeur.optional.userActivity', [])
	.directive('clUserActivity',
		function($window, $timeout, $rootScope, clUserInfoSvc, clEditorSvc, clEditorClassApplier, clContentSyncSvc) {
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
					styleContent += '.user-activity-' + userId + '.show {';
					styleContent += '-webkit-box-shadow: inset -2px 0 0 1px #' + userClass.color + ';';
					styleContent += 'box-shadow: inset -2px 0 0 1px #' + userClass.color + '}';
					var userInfo = clUserInfoSvc.users[userId];
					var escapedUsername = ((userInfo && userInfo.name) || userId).replace(/[\s\S]/g, function(character) {
						var escape = character.charCodeAt().toString(16);
						return '\\' + ('000000' + escape).slice(-6);
					});
					styleContent += '.user-activity-' + userId + '.show::after {';
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

			var Marker = $window.cledit.Marker;

			return {
				restrict: 'E',
				link: link
			};

			function link(scope) {
				createUserClass(scope.userId);
				var classApplier, startMarker, endMarker, timeoutId;

				function unsetHighlighting() {
					startMarker && clEditorSvc.cledit.removeMarker(startMarker);
					endMarker && clEditorSvc.cledit.removeMarker(endMarker);
					classApplier && classApplier.stop();
					$timeout.cancel(timeoutId);
				}

				function highlightOffset(offset) {
					unsetHighlighting();
					if (!offset) {
						return;
					}
					startMarker = new Marker(offset.start);
					endMarker = new Marker(offset.end);
					clEditorSvc.cledit.addMarker(startMarker);
					clEditorSvc.cledit.addMarker(endMarker);
					classApplier = clEditorClassApplier(['user-activity-' + scope.userId, 'user-activity'], function() {
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
						$window.cledit.Utils.defer(function() {
							// Show only one element
							Array.prototype.slice.call(clEditorSvc.editorElt.querySelectorAll('.user-activity-' + scope.userId), -1).forEach(function(elt) {
								elt.classList.add('show');
							});
						});
						return start !== end && {
							start: start,
							end: end
						};
					});
					timeoutId = $timeout(function() {
						if (clContentSyncSvc.watchCtx) {
							delete clContentSyncSvc.watchCtx.userActivities[scope.userId];
						}
					}, 30000);
				}
				scope.$watch('userActivity.offset', highlightOffset);

				scope.$on('$destroy', function() {
					unsetHighlighting();
				});
			}
		});
