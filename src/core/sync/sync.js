angular.module('classeur.core.sync', [])
	.run(function($rootScope, $http, clUserSvc, clFolderSvc) {
		var lastActivity = 0;
		var maxInactivity = 90 * 1000; // 1 minute 30
		function syncFolders() {
			lastActivity = Date.now();
			var folderChanges = {};

			function getChangePage(lastUpdate) {
				return $http.get('/ajax/folder/changes?lastUpdate=' + lastUpdate)
					.success(function(data) {
						data.changes.forEach(function(change) {
							folderChanges[change.id] = change;
						});
						if (data.last) {
							return getChangePage(data.last);
						}
					});
			}
			return getChangePage(0)
				.then(function() {
					console.log(folderChanges);
					return Promise.map(clFolderSvc.folders, function(folderDao) {
						// if(folderDao.sync) {
						// 	folderDao.$readAttr('sync', '{}', JSON.parse);
						// }

						return $http.post('/ajax/folder', {
								id: folderDao.id,
								userId: clUserSvc.user.id,
								name: folderDao.name
							})
							.then(function(res) {
								lastActivity = Date.now();
								console.log('success', res);
							})
							.catch(function(err) {
								lastActivity = Date.now();
								console.log('error', err);
							});
					});
				});
		}

		function sync() {
			if (!clUserSvc.user) {
				return;
			}
			if (Date.now() - lastActivity < maxInactivity) {
				return;
			}
			syncFolders();
		}
		$rootScope.$on('clPeriodicRun', sync);
	});
