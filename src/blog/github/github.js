angular.module('classeur.blog.github', [])
	.directive('clGithubBlogForm', function($window, clLocalSettingSvc, clConstants, clStateMgr) {
		return {
			restrict: 'E',
			templateUrl: 'blog/github/githubBlogForm.html',
			link: function(scope) {
				scope.githubBlog = clLocalSettingSvc.values.githubBlog;
				if (!scope.githubBlog) {
					scope.githubBlog = {
						privateRepo: true
					};
					clLocalSettingSvc.values.githubBlog = scope.githubBlog;
				}

				scope.validateBlog(function() {
					if (!scope.githubBlog.repoUrl) {
						throw 'Repository URL can not be empty.';
					}
					var parsedRepo = scope.githubBlog.repoUrl.match(/[\/:]?([^\/:]+)\/([^\/]+?)(?:\.git)?$/);
					if (!parsedRepo) {
						throw 'Invalid repository URL format.';
					}
					return {
						reponame: parsedRepo[2],
						username: parsedRepo[1]
					};
				});

				scope.createBlog(function() {
					var params = {
						client_id: clConstants.githubClientId,
						response_type: 'code',
						redirect_uri: clConstants.serverUrl + '/oauth/github/callback',
						scope: scope.githubBlog.private ? 'repo' : 'public_repo',
						state: clStateMgr.saveState({
							url: redirectUrl || '/newBlog/github'
						}),
					};
					params = Object.keys(params).map(function(key) {
						return key + '=' + encodeURIComponent(params[key]);
					}).join('&');
					$window.location.href = 'https://accounts.google.com/o/oauth2/auth?' + params;
				});

				scope.updateBlog(function() {

				});
			}
		};
	});
