angular.module('classeur.core.folders', [])
	.factory('clFolderSvc', function(clUid) {

		var folders = JSON.parse(localStorage.folderIds || '[]').map(function(id) {
			return new Folder(id);
		});

		function Folder(id) {
			this.id = id;
			this.name = localStorage['folder.' + this.id + '.name'] || '';
		}

		Folder.prototype.save = function() {
			localStorage['folder.' + this.id + '.name'] = this.name;
		};

		return {
			Folder: Folder,
			folders: folders,
			newFolder: function(name) {
				var folderDao = new Folder(clUid());
				folderDao.name = name;
				folderDao.save();
				folders.push(folderDao);
				localStorage.folderIds = JSON.stringify(folders.map(function(fileDao) {
					return fileDao.id;
				}));
				return folderDao;
			},
			readOnlyFile: function(title, content) {
				return new ReadOnlyFile(title, content);
			}
		};
	});
