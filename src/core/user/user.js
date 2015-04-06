angular.module('classeur.core.user', [])
    .factory('clUserSvc', function($window, $rootScope, $location, clLocalStorageObject, clSocketSvc, clConstants, clStateMgr) {
        var clUserSvc = clLocalStorageObject('userSvc');

        function startOAuth(redirectUrl) {
            var params = {
                client_id: clConstants.googleClientId,
                response_type: 'code',
                redirect_uri: clConstants.serverUrl + '/oauth/google/callback',
                scope: 'profile',
                state: clStateMgr.saveState({
                    url: redirectUrl || '/newUser'
                }),
            };
            params = Object.keys(params).map(function(key) {
                return key + '=' + encodeURIComponent(params[key]);
            }).join('&');
            $window.location.href = 'https://accounts.google.com/o/oauth2/auth?' + params;
        }

        function signin(token) {
            clSocketSvc.setToken(token);
            clSocketSvc.openSocket();
        }

        function signout() {
            clSocketSvc.clearToken();
            clSocketSvc.closeSocket();
            clUserSvc.user = null;
        }

        clUserSvc.read = function() {
            this.$readAttr('user', null, JSON.parse);
            this.$readUpdate();
        };

        clUserSvc.write = function(updated) {
            this.$writeAttr('user', JSON.stringify, updated);
        };

        function checkAll() {
            if (clUserSvc.$checkUpdate()) {
                clUserSvc.read();
                return true;
            } else {
                clUserSvc.write();
            }
        }

        function updateUser(user) {
            if (!user.name) {
                throw 'User name can\'t be empty.';
            }
            clUserSvc.user = user;
        }

        clUserSvc.read();

        clSocketSvc.addMsgHandler('invalidToken', function() {
            signout();
            $rootScope.$evalAsync();
        });

        clUserSvc.startOAuth = startOAuth;
        clUserSvc.signin = signin;
        clUserSvc.signout = signout;
        clUserSvc.checkAll = checkAll;
        clUserSvc.updateUser = updateUser;

        return clUserSvc;
    })
    .factory('clUserInfoSvc', function($rootScope, $window, $http, clSetInterval, clUserSvc) {
        var requestedUserInfo = {};
        var userInfoTimeout = 30 * 1000; // 30 sec
        var lastUserInfoAttempt = 0;

        clSetInterval(function() {
            if($window.navigator.onLine === false) {
                return;
            }
            var currentDate = Date.now();
            var ids = Object.keys(requestedUserInfo);
            if (!ids.length || currentDate - lastUserInfoAttempt < userInfoTimeout) {
                return;
            }
            lastUserInfoAttempt = currentDate;
            $http.get('/api/metadata/users', {
                    timeout: userInfoTimeout,
                    params: {
                        id: ids.join(',')
                    }
                })
                .success(function(res) {
                    lastUserInfoAttempt = 0;
                    clUserInfoSvc.lastUserInfo = Date.now();
                    res.forEach(function(user) {
                        clUserInfoSvc.users[user.id] = user;
                        delete requestedUserInfo[user.id];
                    });
                });
        }, 1100);

        $rootScope.$watch('userSvc.user', function(user) {
            if (user) {
                clUserInfoSvc.users[user.id] = {
                    id: user.id,
                    name: user.name
                };
                clUserInfoSvc.lastUserInfo = Date.now();
            }
        });

        var clUserInfoSvc = {
            users: {},
            request: function(id) {
                if (!clUserInfoSvc.hasOwnProperty(id)) {
                    if (!clUserSvc.user || clUserSvc.user.id !== id) {
                        requestedUserInfo[id] = true;
                    }
                }
            }
        };

        return clUserInfoSvc;
    })
    .directive('clNewUserForm', function($location, $http, clToast, clUserSvc, clStateMgr) {
        return {
            restrict: 'E',
            templateUrl: 'core/user/newUserForm.html',
            link: function(scope) {
                scope.close = function() {
                    $location.url('');
                };

                if (!clStateMgr.state) {
                    return scope.close();
                }

                var name = clStateMgr.state.$search.name;
                var userToken = clStateMgr.state.$search.userToken;
                var newUserToken = clStateMgr.state.$search.newUserToken;
                if (!userToken && !newUserToken) {
                    return scope.close();
                }

                if (userToken) {
                    clUserSvc.signin(userToken);
                    return scope.close();
                }

                scope.create = function() {
                    if (!scope.newUser.name) {
                        return;
                    }
                    scope.isLoading = true;
                    $http.post('/api/users', {
                            name: scope.newUser.name,
                            token: newUserToken
                        })
                        .success(function(userToken) {
                            clUserSvc.signin(userToken);
                            $location.url('');
                        })
                        .error(function(data, status) {
                            clToast(data.reason || 'Error: ' + status);
                        });
                };

                scope.newUser = {
                    name: name || ''
                };
            }
        };
    });
