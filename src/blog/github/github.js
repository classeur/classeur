angular.module('classeur.blog.github', [])
	.directive('clGithubBlogForm', function($window, clLocalSettingSvc, clConstants, clStateMgr) {
		return {
			restrict: 'E',
			templateUrl: 'blog/github/githubBlogForm.html',
			link: function(scope) {
				scope.githubBlog = clLocalSettingSvc.values.githubBlog;
				if (!scope.githubBlog) {
					scope.githubBlog = {};
					clLocalSettingSvc.values.githubBlog = scope.githubBlog;
				}

				scope.validate = function() {

				};

				scope.create = function() {
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
				};

				scope.update = function() {

				};
			}
		};
	});
