angular.module('classeur.optional.userMgtPage', [])
	.config(
		function($routeProvider) {
			$routeProvider
				.when('/users', {
					template: '<cl-user-mgt-page></cl-user-mgt-page>',
					controller: function(clAnalytics) {
						clAnalytics.trackPage('/users');
					}
				});
		})
	.directive('clUserMgtPage',
		function($http, $location, clToast, clDialog, clSocketSvc) {
			return {
				restrict: 'E',
				templateUrl: 'optional/userMgtPage/userMgtPage.html',
				link: link
			};

			function link(scope) {
				scope.properties = [];
				scope.deleteRow = function(userToDelete) {
					var confirmDialog = clDialog.confirm()
						.title('Delete user')
						.content('Your about to delete a user and all her files. This can\'t be undone. Are you sure?')
						.ariaLabel('Delete user')
						.ok('Yes, delete all')
						.cancel('No');
					clDialog.show(confirmDialog).then(function() {
						$http.delete('/api/v1/users/' + userToDelete.id, {
								headers: clSocketSvc.makeAuthorizationHeader()
							})
							.success(function() {
								scope.users = scope.users.cl_filter(function(user) {
									return user.id !== userToDelete.id;
								});
							})
							.error(function(err) {
								clToast('Error: ' + err.reason || 'unknown');
							});
					});
				};

				scope.$watch(function() {
					return scope.users && scope.users.cl_map(function(user) {
						return user.isAdmin;
					}).join(',');
				}, function() {
					scope.users && scope.users.cl_each(function(user) {
						if (user.isAdmin !== (user.roles.indexOf('admin') !== -1)) {
							var newRoles = user.isAdmin ? ['admin'] : [];
							$http.patch('/api/v1/users/' + user.id, {
								roles: user.isAdmin ? ['admin'] : []
							}, {
								headers: clSocketSvc.makeAuthorizationHeader(),
							});
							user.roles = newRoles;
						}
					});
				});

				function retrieveUsers() {
					$http.get('/api/v1/users', {
							headers: clSocketSvc.makeAuthorizationHeader()
						})
						.success(function(res) {
							scope.users = res.sort(function(user1, user2) {
								return user1.name > user2.name;
							});
							scope.users.cl_each(function(user) {
								user.isAdmin = user.roles.indexOf('admin') !== -1;
							});
						})
						.error(function(err) {
							clToast('Error: ' + err.reason || 'unknown');
						});
				}
				retrieveUsers();
			}
		});
