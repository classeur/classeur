angular.module('classeur.core.user', [])
    .factory('clUserSvc', function($rootScope, $location, clSettingSvc) {
        clSettingSvc.setDefaultValue('defaultUserName', 'Anonymous');
        var userTokenKey = 'userToken';
        var userToken = localStorage[userTokenKey];
        var userSocket;

        function setToken(token) {
            userToken = token;
            localStorage[userTokenKey] = token;
        }

        function openSocket() {
            closeSocket();
            userSocket = new WebSocket('ws://' + $location.host() + ':' + $location.port() + '/?token=' + userToken);
            userSocket.onopen = function() {
                clUserSvc.isReady = true;
            };
            userSocket.onmessage = function(event) {
                console.log(event.data);
                var msg = JSON.parse(event.data);
                if(msg.type === 'signedIn') {
                    setToken(msg.token);
                    clUserSvc.user = msg.user;
                    $rootScope.$apply();
                }
            };
        }

        function closeSocket() {
            userSocket && userSocket.close();
            userSocket = undefined;
        }

        function signin(token) {
            setToken(token);
            openSocket();
        }

        function signout() {
            localStorage.removeItem(userTokenKey);
            userToken = undefined;
            clUserSvc.user = undefined;
            closeSocket();
        }

        userToken && openSocket();

        var clUserSvc = {
            isReady: false,
            signin: signin,
            signout: signout,
            openSocket: openSocket
        };

        return clUserSvc;
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
                    $http.post('/ajax/user/new', {
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
