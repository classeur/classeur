angular.module('classeur.blog.github', [])
	.directive('clGithubBlogEntry', function() {
		return {
			restrict: 'E',
			templateUrl: 'blog/github/githubBlogEntry.html'
		};
	})
	.directive('clGithubBlogForm', function() {
		return {
			restrict: 'E',
			templateUrl: 'blog/github/githubBlogForm.html',
			link: function(scope) {
				scope.githubBlog = {
					privateRepo: true
				};

				scope.setValidator(function() {
					if (!scope.githubBlog.repoUrl) {
						throw 'Repository URL can not be empty.';
					}
					var parsedRepo = scope.githubBlog.repoUrl.match(/[\/:]?([^\/:]+)\/([^\/]+?)(?:\.git)?$/);
					if (!parsedRepo) {
						throw 'Invalid repository URL format.';
					}
					var result = {
						repo: parsedRepo[2],
						user: parsedRepo[1],
						privateRepo: scope.githubBlog.privateRepo
					};
					if (result.repo.length > 128 || result.user.length > 128) {
						throw 'Repository URL is too long.';
					}
					return result;
				});

				scope.link(function() {})

				// scope.create(function() {
				// 	var params = {
				// 		client_id: clConstants.githubClientId,
				// 		response_type: 'code',
				// 		redirect_uri: clConstants.serverUrl + '/oauth/github/callback',
				// 		scope: scope.githubBlog.private ? 'repo' : 'public_repo',
				// 		state: clStateMgr.saveState({
				// 			url: redirectUrl || '/newBlog/github'
				// 		}),
				// 	};
				// 	params = Object.keys(params).map(function(key) {
				// 		return key + '=' + encodeURIComponent(params[key]);
				// 	}).join('&');
				// 	$window.location.href = 'https://accounts.google.com/o/oauth2/auth?' + params;
				// });
			}
		};
	})
	.factory('clGithubBlogSvc', function($window, clConstants) {

		return {
			startOAuth: function(blog, state) {
				var params = {
					client_id: clConstants.githubClientId,
					response_type: 'code',
					redirect_uri: clConstants.serverUrl + '/oauth/github/callback',
					scope: blog.private ? 'repo' : 'public_repo',
					state: state,
				};
				params = Object.keys(params).map(function(key) {
					return key + '=' + encodeURIComponent(params[key]);
				}).join('&');
				$window.location.href = 'https://accounts.google.com/o/oauth2/auth?' + params;
			}
		};

	});
