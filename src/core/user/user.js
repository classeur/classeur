angular.module('classeur.core.user', [])
    .factory('clUserSvc', function($rootScope, $location, clLocalStorageObject, clSocketSvc) {
        var clUserSvc = clLocalStorageObject('userSvc');

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
            this.$readLocalUpdate();
        };

        clUserSvc.write = function(updated) {
            this.$writeAttr('user', JSON.stringify, updated);
        };

        function checkAll() {
            if (clUserSvc.$checkGlobalUpdate()) {
                clUserSvc.read();
                return true;
            } else {
                clUserSvc.write();
            }
        }

        clUserSvc.read();

        clSocketSvc.addMsgHandler('invalidToken', function() {
            signout();
            $rootScope.$evalAsync();
        });

        clUserSvc.signin = signin;
        clUserSvc.signout = signout;
        clUserSvc.checkAll = checkAll;

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

                scope.create = function() {
                    if (!scope.newUser.name) {
                        return;
                    }
                    scope.isLoading = true;
                    $http.post('/api/users', {
                            name: scope.newUser.name,
                            syncFilesAndSettings: scope.newUser.syncFilesAndSettings,
                            token: clStateMgr.token
                        })
                        .success(function(userToken) {
                            clUserSvc.signin(userToken);
                            $location.url('');
                        })
                        .error(function(data, status) {
                            clToast(data.reason || 'Error: ' + status);
                        });
                };

                if (!clStateMgr.token) {
                    return scope.close();
                }

                // Decode JWT
                var data = clStateMgr.token && clStateMgr.token.split('.');
                try {
                    scope.newUser = JSON.parse(atob(data[1]));
                } catch (e) {
                    return scope.close();
                }

                if (scope.newUser.type === 'user') {
                    clUserSvc.signin(clStateMgr.token);
                    return scope.close();
                }

                scope.newUser.syncFilesAndSettings = true;
            }
        };
    });
