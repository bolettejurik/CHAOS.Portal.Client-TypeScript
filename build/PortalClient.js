var CHAOS;
(function (CHAOS) {
    (function (Portal) {
        (function (Client) {
            (function (HttpMethod) {
                HttpMethod[HttpMethod["Get"] = 0] = "Get";
                HttpMethod[HttpMethod["Post"] = 1] = "Post";
            })(Client.HttpMethod || (Client.HttpMethod = {}));
            var HttpMethod = Client.HttpMethod;
        })(Portal.Client || (Portal.Client = {}));
        var Client = Portal.Client;
    })(CHAOS.Portal || (CHAOS.Portal = {}));
    var Portal = CHAOS.Portal;
})(CHAOS || (CHAOS = {}));
var CHAOS;
(function (CHAOS) {
    (function (Portal) {
        /// <reference path="Data.ts"/>
        (function (Client) {
            var PortalClient = (function () {
                function PortalClient(servicePath, clientGuid) {
                    if (typeof clientGuid === "undefined") { clientGuid = null; }
                    this._authenticationType = null;
                    if (typeof servicePath === "undefined")
                        throw new Error("Parameter servicePath must be set");

                    if (servicePath.substr(servicePath.length - 1, 1) != "/")
                        servicePath += "/";

                    this._servicePath = servicePath;
                    this.ClientGuid = clientGuid;

                    this._sessionAcquired = new Event(this);
                    this._sessionAuthenticated = new Event(this);
                }
                PortalClient.GetClientVersion = function () {
                    return "2.8.0";
                };
                PortalClient.GetProtocolVersion = function () {
                    return 6;
                };

                PortalClient.prototype.GetServicePath = function () {
                    return this._servicePath;
                };
                PortalClient.prototype.GetCurrentSession = function () {
                    return this._currentSession;
                };
                PortalClient.prototype.HasSession = function () {
                    return this.GetCurrentSession() != null;
                };
                PortalClient.prototype.IsAuthenticated = function () {
                    return this._authenticationType != null;
                };
                PortalClient.prototype.SessionAcquired = function () {
                    return this._sessionAcquired;
                };
                PortalClient.prototype.SessionAuthenticated = function () {
                    return this._sessionAuthenticated;
                };

                PortalClient.prototype.CallService = function (path, method, parameters, requiresSession) {
                    if (typeof method === "undefined") { method = Client.HttpMethod.Get; }
                    if (typeof parameters === "undefined") { parameters = null; }
                    if (typeof requiresSession === "undefined") { requiresSession = true; }
                    if (requiresSession)
                        parameters = this.AddSessionToParameters(parameters);

                    return new CallState().Call(this.GetPathToExtension(path), method, parameters);
                };

                PortalClient.prototype.GetServiceCallUri = function (path, parameters, requiresSession, format) {
                    if (typeof parameters === "undefined") { parameters = null; }
                    if (typeof requiresSession === "undefined") { requiresSession = true; }
                    if (typeof format === "undefined") { format = "json2"; }
                    if (requiresSession)
                        parameters = this.AddSessionToParameters(parameters);

                    return this.GetPathToExtension(path) + "?" + ServiceCall.CreateDataStringWithPortalParameters(parameters, format);
                };

                PortalClient.prototype.GetPathToExtension = function (path) {
                    return this.GetServicePath() + "v" + PortalClient.GetProtocolVersion() + "/" + path;
                };

                PortalClient.prototype.AddSessionToParameters = function (parameters) {
                    if (parameters == null)
                        parameters = {};

                    if (!this.HasSession())
                        throw new Error("Session not acquired");

                    parameters["sessionGUID"] = this.GetCurrentSession().Guid;

                    return parameters;
                };

                PortalClient.prototype.UpdateSession = function (session) {
                    var hadSession = this._currentSession != null;

                    this._currentSession = session;

                    if (!hadSession && session != null)
                        this._sessionAcquired.Raise(session);
                };

                PortalClient.prototype.SetSessionAuthenticated = function (type, userGuid, sessionDateModified) {
                    this._authenticationType = type;

                    if (type != null) {
                        if (userGuid != null)
                            this._currentSession.UserGuid = userGuid;
                        if (sessionDateModified != null)
                            this._currentSession.DateModified = sessionDateModified;

                        this._sessionAuthenticated.Raise(type);
                    }
                };
                return PortalClient;
            })();
            Client.PortalClient = PortalClient;

            var CallState = (function () {
                function CallState() {
                }
                CallState.prototype.Call = function (path, method, parameters) {
                    if (typeof parameters === "undefined") { parameters = null; }
                    var _this = this;
                    this._completed = new Event(this);
                    this._call = new ServiceCall();

                    this._call.Call(function (response) {
                        return _this._completed.Raise(response);
                    }, path, method, parameters);

                    return this;
                };

                CallState.prototype.WithCallback = function (callback, context) {
                    if (typeof context === "undefined") { context = null; }
                    if (context == null)
                        this._completed.Add(callback);
else
                        this._completed.Add(function (response) {
                            return callback.call(context, response);
                        });

                    return this;
                };

                CallState.prototype.WithCallbackAndToken = function (callback, token, context) {
                    if (typeof context === "undefined") { context = null; }
                    if (context == null)
                        this._completed.Add(function (response) {
                            return callback(response, token);
                        });
else
                        this._completed.Add(function (response) {
                            return callback.call(context, response, token);
                        });

                    return this;
                };
                return CallState;
            })();

            var ServiceCall = (function () {
                function ServiceCall() {
                }
                ServiceCall.prototype.Call = function (callback, path, method, parameters) {
                    if (typeof parameters === "undefined") { parameters = null; }
                    var _this = this;
                    var data = ServiceCall.CreateDataStringWithPortalParameters(parameters);

                    if (method == Client.HttpMethod.Get) {
                        path += "?" + data;
                        data = null;
                    }

                    this._request = window["XMLHttpRequest"] ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
                    this._callback = callback;

                    if ("withCredentials" in this._request) {
                        if (callback != null)
                            this._request.onreadystatechange = function () {
                                return _this.RequestStateChange();
                            };

                        this._request.open(method == Client.HttpMethod.Get ? "Get" : "Post", path, true);

                        if (method == Client.HttpMethod.Post)
                            this._request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

                        this._request.send(data);
                    } else if (window["XDomainRequest"]) {
                        this._request = new XDomainRequest();

                        if (callback != null) {
                            this._request.onload = function () {
                                return _this.ParseResponse(_this._request.responseText);
                            };
                            this._request.onerror = this._request.ontimeout = function () {
                                return _this.ReportError();
                            };
                        }

                        this._request.open(method == Client.HttpMethod.Get ? "Get" : "Post", path);
                        this._request.send(data);

                        if (callback != null && this._request.responseText != "")
                            setTimeout(function () {
                                return _this.ParseResponse(_this._request.responseText);
                            }, 1);
                    } else
                        throw new Error("Browser does not supper AJAX requests");
                };

                ServiceCall.prototype.RequestStateChange = function () {
                    if (this._request.readyState != 4)
                        return;

                    if (this._request.status == 200)
                        this.ParseResponse(this._request.responseText);
else
                        this.ReportError();
                };

                ServiceCall.prototype.ParseResponse = function (responseText) {
                    var response = JSON && JSON.parse(responseText) || eval(responseText);

                    if (response.Error != null && response.Error.Fullname == null)
                        response.Error = null;

                    this._callback(response);
                };

                ServiceCall.prototype.ReportError = function () {
                    this._callback({ Header: null, Body: null, Error: { Fullname: "ServiceError", Message: "Service call failed", Stacktrace: null, InnerException: null } });
                };

                ServiceCall.CreateDataStringWithPortalParameters = function (parameters, format) {
                    if (typeof format === "undefined") { format = "json2"; }
                    if (parameters == null)
                        parameters = {};

                    parameters["format"] = format;
                    parameters["userHTTPStatusCodes"] = "False";

                    return ServiceCall.CreateDataString(parameters);
                };

                ServiceCall.CreateDataString = function (parameters) {
                    var result = "";
                    var first = true;
                    var value = null;
                    for (var key in parameters) {
                        value = parameters[key];
                        if (value == null || typeof value === 'undefined')
                            continue;

                        if (Client.Object.prototype.toString.call(value) === '[object Date]')
                            value = ServiceCall.ConvertDate(value);

                        result += (first ? "" : "&") + key + "=" + encodeURIComponent(value);

                        if (first)
                            first = false;
                    }

                    return result;
                };

                ServiceCall.ConvertDate = function (date) {
                    return ServiceCall.ToTwoDigits(date.getUTCDate()) + "-" + ServiceCall.ToTwoDigits(date.getUTCMonth() + 1) + "-" + date.getUTCFullYear() + " " + ServiceCall.ToTwoDigits(date.getUTCHours()) + ":" + ServiceCall.ToTwoDigits(date.getUTCMinutes()) + ":" + ServiceCall.ToTwoDigits(date.getUTCSeconds());
                };

                ServiceCall.ToTwoDigits = function (value) {
                    return value < 10 ? "0" + value : value.toString();
                };
                return ServiceCall;
            })();

            var Event = (function () {
                function Event(sender) {
                    this.sender = sender;
                    this._handlers = [];
                    if (typeof sender === "undefined")
                        throw new Error("Parameter sender must be set");

                    this._sender = sender;
                }
                Event.prototype.Add = function (handler) {
                    if (handler == undefined || handler == null)
                        throw new Error("handler must be defined");

                    this._handlers.push(handler);
                };

                Event.prototype.Remove = function (handler) {
                    if (handler == undefined || handler == null)
                        throw new Error("handler must be defined");

                    for (var i = 0; i < this._handlers.length; i++) {
                        if (this._handlers[i] === handler) {
                            this._handlers.splice(i, 1);
                            return;
                        }
                    }
                };

                Event.prototype.Raise = function (data) {
                    for (var i = 0; i < this._handlers.length; i++)
                        this._handlers[i].call(this._sender, data);
                };
                return Event;
            })();
        })(Portal.Client || (Portal.Client = {}));
        var Client = Portal.Client;
    })(CHAOS.Portal || (CHAOS.Portal = {}));
    var Portal = CHAOS.Portal;
})(CHAOS || (CHAOS = {}));
var CHAOS;
(function (CHAOS) {
    (function (Portal) {
        /// <reference path="Data.ts" />
        /// <reference path="PortalClient.ts"/>
        (function (Client) {
            var EmailPassword = (function () {
                function EmailPassword() {
                }
                EmailPassword.AuthenticationType = function () {
                    return "EmailPassword";
                };

                EmailPassword.Login = function (email, password, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("EmailPassword/Login", Client.HttpMethod.Post, { email: email, password: password }).WithCallback(function (response) {
                        if (response.Error == null)
                            serviceCaller.SetSessionAuthenticated(EmailPassword.AuthenticationType(), response.Body.Results[0].Guid, response.Body.Results[0].SessionDateModified);
                    });
                };

                EmailPassword.SetPassword = function (userGuid, newPassword, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("EmailPassword/SetPassword", Client.HttpMethod.Post, { userGuid: userGuid, newPassword: newPassword });
                };
                return EmailPassword;
            })();
            Client.EmailPassword = EmailPassword;

            var SecureCookie = (function () {
                function SecureCookie() {
                }
                SecureCookie.AuthenticationType = function () {
                    return "SecureCookie";
                };

                SecureCookie.Create = function (serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("SecureCookie/Create");
                };

                SecureCookie.Login = function (guid, passwordGuid, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("SecureCookie/Login", Client.HttpMethod.Post, { guid: guid, passwordGuid: passwordGuid }).WithCallback(function (response) {
                        if (response.Error == null) {
                            serviceCaller.SetSessionAuthenticated(SecureCookie.AuthenticationType(), null, null);
                            Client.Session.Get(serviceCaller);
                        }
                    });
                };
                return SecureCookie;
            })();
            Client.SecureCookie = SecureCookie;

            var Facebook = (function () {
                function Facebook() {
                }
                Facebook.AuthenticationType = function () {
                    return "Facebook";
                };

                Facebook.Login = function (signedRequest, userAccessToken, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Facebook/Login", Client.HttpMethod.Post, { signedRequest: signedRequest, userAccessToken: userAccessToken }).WithCallback(function (response) {
                        if (response.Error == null) {
                            serviceCaller.SetSessionAuthenticated(Facebook.AuthenticationType(), response.Body.Results[0].UserGuid, null);
                            Client.Session.Get(serviceCaller);
                        }
                    });
                };
                return Facebook;
            })();
            Client.Facebook = Facebook;

            var AuthKey = (function () {
                function AuthKey() {
                }
                AuthKey.AuthenticationType = function () {
                    return "AuthKey";
                };

                AuthKey.Create = function (name, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("AuthKey/Create", Client.HttpMethod.Get, { name: name });
                };

                AuthKey.Login = function (token, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("AuthKey/Login", Client.HttpMethod.Post, { token: token }).WithCallback(function (response) {
                        if (response.Error == null) {
                            serviceCaller.SetSessionAuthenticated(AuthKey.AuthenticationType(), response.Body.Results[0].UserGuid, null);
                            Client.Session.Get(serviceCaller);
                        }
                    });
                };

                AuthKey.Get = function (serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("AuthKey/Get");
                };

                AuthKey.Delete = function (name, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("AuthKey/Delete", Client.HttpMethod.Get, { name: name });
                };
                return AuthKey;
            })();
            Client.AuthKey = AuthKey;
        })(Portal.Client || (Portal.Client = {}));
        var Client = Portal.Client;
    })(CHAOS.Portal || (CHAOS.Portal = {}));
    var Portal = CHAOS.Portal;
})(CHAOS || (CHAOS = {}));
var CHAOS;
(function (CHAOS) {
    (function (Portal) {
        /// <reference path="Data.ts" />
        /// <reference path="PortalClient.ts"/>
        (function (Client) {
            var Session = (function () {
                function Session() {
                }
                Session.Create = function (serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Session/Create", Client.HttpMethod.Get, null, false).WithCallback(function (response) {
                        if (response.Error == null)
                            serviceCaller.UpdateSession(response.Body.Results[0]);
                    });
                };

                Session.Get = function (serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Session/Get").WithCallback(function (response) {
                        if (response.Error == null)
                            serviceCaller.UpdateSession(response.Body.Results[0]);
                    });
                };

                Session.Update = function (serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Session/Update").WithCallback(function (response) {
                        if (response.Error == null)
                            serviceCaller.UpdateSession(response.Body.Results[0]);
                    });
                };

                Session.Delete = function (serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Session/Delete").WithCallback(function (response) {
                        if (response.Error == null) {
                            serviceCaller.SetSessionAuthenticated(null, null, null);
                            serviceCaller.UpdateSession(null);
                        }
                    });
                };
                return Session;
            })();
            Client.Session = Session;

            var User = (function () {
                function User() {
                }
                User.Create = function (guid, email, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("User/Create", Client.HttpMethod.Post, { guid: guid, email: email });
                };

                User.Update = function (guid, email, permissons, serviceCaller) {
                    if (typeof permissons === "undefined") { permissons = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("User/Update", Client.HttpMethod.Post, { guid: guid, email: email, permissons: permissons }, true);
                };

                User.Delete = function (guid, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("User/Delete", Client.HttpMethod.Get, { guid: guid });
                };

                User.Get = function (guid, groupGuid, serviceCaller) {
                    if (typeof guid === "undefined") { guid = null; }
                    if (typeof groupGuid === "undefined") { groupGuid = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("User/Get", Client.HttpMethod.Get, { guid: guid, groupGuid: groupGuid });
                };

                User.GetCurrent = function (serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("User/GetCurrent");
                };
                return User;
            })();
            Client.User = User;

            var Group = (function () {
                function Group() {
                }
                Group.Get = function (guid, userGuid, serviceCaller) {
                    if (typeof guid === "undefined") { guid = null; }
                    if (typeof userGuid === "undefined") { userGuid = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Group/Get", Client.HttpMethod.Get, { guid: guid, userGuid: userGuid });
                };

                Group.Create = function (name, systemPermission, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Group/Create", Client.HttpMethod.Get, { name: name, systemPermission: systemPermission });
                };

                Group.Update = function (guid, newName, newSystemPermission, serviceCaller) {
                    if (typeof newSystemPermission === "undefined") { newSystemPermission = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Group/Update", Client.HttpMethod.Get, { guid: guid, newName: newName, newSystemPermission: newSystemPermission });
                };

                Group.Delete = function (guid, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Group/Delete", Client.HttpMethod.Get, { guid: guid });
                };

                Group.AddUser = function (guid, userGuid, permissions, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Group/AddUser", Client.HttpMethod.Get, { guid: guid, userGuid: userGuid, permissions: permissions });
                };

                Group.RemoveUser = function (guid, userGuid, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Group/RemoveUser", Client.HttpMethod.Get, { guid: guid, userGuid: userGuid });
                };

                Group.UpdateUserPermissions = function (guid, userGuid, permissions, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Group/UpdateUserPermissions", Client.HttpMethod.Get, { guid: guid, userGuid: userGuid, permissions: permissions });
                };
                return Group;
            })();
            Client.Group = Group;

            var View = (function () {
                function View() {
                }
                View.Get = function (view, query, sort, filter, pageIndex, pageSize, serviceCaller) {
                    if (typeof query === "undefined") { query = null; }
                    if (typeof sort === "undefined") { sort = null; }
                    if (typeof filter === "undefined") { filter = null; }
                    if (typeof pageIndex === "undefined") { pageIndex = 0; }
                    if (typeof pageSize === "undefined") { pageSize = 10; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("View/Get", Client.HttpMethod.Get, { view: view, query: query, sort: sort, filter: filter, pageIndex: pageIndex, pageSize: pageSize });
                };

                View.List = function (serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("View/List");
                };
                return View;
            })();
            Client.View = View;

            var ClientSettings = (function () {
                function ClientSettings() {
                }
                ClientSettings.Get = function (guid, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("ClientSettings/Get", Client.HttpMethod.Get, { guid: guid });
                };

                ClientSettings.Set = function (guid, name, settings, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("ClientSettings/Set", Client.HttpMethod.Post, { guid: guid, name: name, settings: settings });
                };
                return ClientSettings;
            })();
            Client.ClientSettings = ClientSettings;

            function Initialize(servicePath, clientGUID, autoCreateSession) {
                if (typeof clientGUID === "undefined") { clientGUID = null; }
                if (typeof autoCreateSession === "undefined") { autoCreateSession = true; }
                var client = new Client.PortalClient(servicePath, clientGUID);

                if (autoCreateSession)
                    Session.Create(client);

                ServiceCallerService.SetDefaultCaller(client);

                return client;
            }
            Client.Initialize = Initialize;

            var ServiceCallerService = (function () {
                function ServiceCallerService() {
                }
                ServiceCallerService.GetDefaultCaller = function () {
                    if (ServiceCallerService._defaultCaller == null)
                        throw new Error("Default service caller not set");

                    return ServiceCallerService._defaultCaller;
                };

                ServiceCallerService.SetDefaultCaller = function (value) {
                    ServiceCallerService._defaultCaller = value;
                };
                ServiceCallerService._defaultCaller = null;
                return ServiceCallerService;
            })();
            Client.ServiceCallerService = ServiceCallerService;
        })(Portal.Client || (Portal.Client = {}));
        var Client = Portal.Client;
    })(CHAOS.Portal || (CHAOS.Portal = {}));
    var Portal = CHAOS.Portal;
})(CHAOS || (CHAOS = {}));
var CHAOS;
(function (CHAOS) {
    (function (Portal) {
        /// <reference path="PortalClient.ts"/>
        /// <reference path="PortalExtensions.ts"/>
        (function (Client) {
            var MetadataSchema = (function () {
                function MetadataSchema() {
                }
                MetadataSchema.Get = function (guid, serviceCaller) {
                    if (typeof guid === "undefined") { guid = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("MetadataSchema/Get", CHAOS.Portal.Client.HttpMethod.Get, { guid: guid }, true);
                };

                MetadataSchema.Create = function (name, schemaXml, guid, serviceCaller) {
                    if (typeof guid === "undefined") { guid = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("MetadataSchema/Create", CHAOS.Portal.Client.HttpMethod.Post, { name: name, schemaXml: schemaXml, guid: guid }, true);
                };

                MetadataSchema.Update = function (name, schemaXml, guid, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("MetadataSchema/Update", CHAOS.Portal.Client.HttpMethod.Post, { name: name, schemaXml: schemaXml, guid: guid }, true);
                };

                MetadataSchema.Delete = function (guid, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("MetadataSchema/Delete", CHAOS.Portal.Client.HttpMethod.Get, { guid: guid }, true);
                };

                MetadataSchema.HasPermissionToMetadataSchema = function (guid, permission, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("MetadataSchema/HasPermissionToMetadataSchema", CHAOS.Portal.Client.HttpMethod.Get, { guid: guid, permission: permission }, true);
                };
                return MetadataSchema;
            })();
            Client.MetadataSchema = MetadataSchema;

            var Folder = (function () {
                function Folder() {
                }
                Folder.GetPermission = function (folderID, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Folder/GetPermission", CHAOS.Portal.Client.HttpMethod.Get, { folderID: folderID }, true);
                };

                Folder.SetPermission = function (userGuid, groupGuid, folderID, permission, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Folder/SetPermission", CHAOS.Portal.Client.HttpMethod.Get, { userGuid: userGuid, groupGuid: groupGuid, folderID: folderID, permission: permission }, true);
                };

                Folder.Get = function (id, folderTypeID, parentID, permission, serviceCaller) {
                    if (typeof id === "undefined") { id = null; }
                    if (typeof folderTypeID === "undefined") { folderTypeID = null; }
                    if (typeof parentID === "undefined") { parentID = null; }
                    if (typeof permission === "undefined") { permission = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Folder/Get", CHAOS.Portal.Client.HttpMethod.Get, { id: id, folderTypeID: folderTypeID, parentID: parentID, permission: permission }, true);
                };

                Folder.Delete = function (id, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Folder/Delete", CHAOS.Portal.Client.HttpMethod.Get, { id: id }, true);
                };

                Folder.Update = function (id, newTitle, newParentID, newFolderTypeID, serviceCaller) {
                    if (typeof newParentID === "undefined") { newParentID = null; }
                    if (typeof newFolderTypeID === "undefined") { newFolderTypeID = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Folder/Update", CHAOS.Portal.Client.HttpMethod.Get, { id: id, newTitle: newTitle, newFolderTypeID: newFolderTypeID, newParentID: newParentID }, true);
                };

                Folder.Create = function (subscriptionGuid, title, parentID, folderTypeID, serviceCaller) {
                    if (typeof parentID === "undefined") { parentID = null; }
                    if (typeof folderTypeID === "undefined") { folderTypeID = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Folder/Create", CHAOS.Portal.Client.HttpMethod.Get, { subscriptionGuid: subscriptionGuid, title: title, parentID: parentID, folderTypeID: folderTypeID }, true);
                };
                return Folder;
            })();
            Client.Folder = Folder;

            var FolderType = (function () {
                function FolderType() {
                }
                FolderType.Get = function (name, serviceCaller) {
                    if (typeof name === "undefined") { name = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("FolderType/Get", CHAOS.Portal.Client.HttpMethod.Get, { name: name }, true);
                };
                return FolderType;
            })();
            Client.FolderType = FolderType;

            var Format = (function () {
                function Format() {
                }
                Format.Get = function (name, serviceCaller) {
                    if (typeof name === "undefined") { name = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Format/Get", CHAOS.Portal.Client.HttpMethod.Get, { name: name }, true);
                };
                return Format;
            })();
            Client.Format = Format;

            var FormatType = (function () {
                function FormatType() {
                }
                FormatType.Get = function (name, serviceCaller) {
                    if (typeof name === "undefined") { name = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("FormatType/Get", CHAOS.Portal.Client.HttpMethod.Get, { name: name }, true);
                };
                return FormatType;
            })();
            Client.FormatType = FormatType;

            var Language = (function () {
                function Language() {
                }
                Language.Get = function (name, languageCode, serviceCaller) {
                    if (typeof name === "undefined") { name = null; }
                    if (typeof languageCode === "undefined") { languageCode = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Language/Get", CHAOS.Portal.Client.HttpMethod.Get, { name: name, languageCode: languageCode }, true);
                };
                return Language;
            })();
            Client.Language = Language;

            var Object = (function () {
                function Object() {
                }
                Object.Create = function (guid, objectTypeID, folderID, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Object/Create", CHAOS.Portal.Client.HttpMethod.Get, { guid: guid, objectTypeID: objectTypeID, folderID: folderID }, true);
                };

                Object.Get = function (objectGuids, accessPointGuid, includeMetadata, includeFiles, includeObjectRelations, includeFolders, includeAccessPoints, pageSize, pageIndex, serviceCaller) {
                    if (typeof accessPointGuid === "undefined") { accessPointGuid = null; }
                    if (typeof includeMetadata === "undefined") { includeMetadata = false; }
                    if (typeof includeFiles === "undefined") { includeFiles = false; }
                    if (typeof includeObjectRelations === "undefined") { includeObjectRelations = false; }
                    if (typeof includeFolders === "undefined") { includeFolders = false; }
                    if (typeof includeAccessPoints === "undefined") { includeAccessPoints = false; }
                    if (typeof pageSize === "undefined") { pageSize = 10; }
                    if (typeof pageIndex === "undefined") { pageIndex = 0; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Object/Get", CHAOS.Portal.Client.HttpMethod.Get, { objectGuids: objectGuids.join(), accessPointGuid: accessPointGuid, includeMetadata: includeMetadata, includeFiles: includeFiles, includeObjectRelations: includeObjectRelations, includeFolders: includeFolders, includeAccessPoints: includeAccessPoints, pageSize: pageSize, pageIndex: pageIndex }, true);
                };

                Object.SetPublishSettings = function (objectGUID, accessPointGUID, startDate, endDate, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Object/SetPublishSettings", CHAOS.Portal.Client.HttpMethod.Get, { objectGUID: objectGUID, accessPointGUID: accessPointGUID, startDate: startDate, endDate: endDate }, true);
                };
                return Object;
            })();
            Client.Object = Object;

            var ObjectRelation = (function () {
                function ObjectRelation() {
                }
                ObjectRelation.Set = function (object1Guid, object2Guid, objectRelationTypeID, sequence, metadataGuid, metadataSchemaGuid, languageCode, metadataXml, serviceCaller) {
                    if (typeof sequence === "undefined") { sequence = null; }
                    if (typeof metadataGuid === "undefined") { metadataGuid = null; }
                    if (typeof metadataSchemaGuid === "undefined") { metadataSchemaGuid = null; }
                    if (typeof languageCode === "undefined") { languageCode = null; }
                    if (typeof metadataXml === "undefined") { metadataXml = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("ObjectRelation/Set", CHAOS.Portal.Client.HttpMethod.Post, { object1Guid: object1Guid, object2Guid: object2Guid, objectRelationTypeID: objectRelationTypeID, sequence: sequence, metadataGuid: metadataGuid, metadataSchemaGuid: metadataSchemaGuid, languageCode: languageCode, metadataXml: metadataXml }, true);
                };

                ObjectRelation.Delete = function (object1Guid, object2Guid, objectRelationTypeID, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("ObjectRelation/Delete", CHAOS.Portal.Client.HttpMethod.Get, { object1Guid: object1Guid, object2Guid: object2Guid, objectRelationTypeID: objectRelationTypeID }, true);
                };
                return ObjectRelation;
            })();
            Client.ObjectRelation = ObjectRelation;

            var ObjectRelationType = (function () {
                function ObjectRelationType() {
                }
                ObjectRelationType.Get = function (value, serviceCaller) {
                    if (typeof value === "undefined") { value = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("ObjectRelationType/Get", CHAOS.Portal.Client.HttpMethod.Get, { value: value }, true);
                };
                return ObjectRelationType;
            })();
            Client.ObjectRelationType = ObjectRelationType;

            var Metadata = (function () {
                function Metadata() {
                }
                Metadata.Set = function (objectGuid, metadataSchemaGuid, languageCode, revisionID, metadataXml, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("Metadata/Set", CHAOS.Portal.Client.HttpMethod.Post, { objectGuid: objectGuid, metadataSchemaGuid: metadataSchemaGuid, languageCode: languageCode, revisionID: revisionID, metadataXml: metadataXml }, true);
                };
                return Metadata;
            })();
            Client.Metadata = Metadata;

            var ObjectType = (function () {
                function ObjectType() {
                }
                ObjectType.Get = function (serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("ObjectType/Get", CHAOS.Portal.Client.HttpMethod.Get, null, true);
                };

                ObjectType.Set = function (name, id, serviceCaller) {
                    if (typeof id === "undefined") { id = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("ObjectType/Set", CHAOS.Portal.Client.HttpMethod.Get, { id: id, name: name }, true);
                };

                ObjectType.Delete = function (id, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("ObjectType/Delete", CHAOS.Portal.Client.HttpMethod.Get, { id: id }, true);
                };
                return ObjectType;
            })();
            Client.ObjectType = ObjectType;

            var UserManagement = (function () {
                function UserManagement() {
                }
                UserManagement.GetUserFolder = function (userGuid, createIfMissing, serviceCaller) {
                    if (typeof userGuid === "undefined") { userGuid = null; }
                    if (typeof createIfMissing === "undefined") { createIfMissing = true; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("UserManagement/GetUserFolder", CHAOS.Portal.Client.HttpMethod.Get, { userGuid: userGuid, createIfMissing: createIfMissing }, true);
                };

                UserManagement.GetUserObject = function (userGuid, createIfMissing, includeMetata, includeFiles, serviceCaller) {
                    if (typeof userGuid === "undefined") { userGuid = null; }
                    if (typeof createIfMissing === "undefined") { createIfMissing = true; }
                    if (typeof includeMetata === "undefined") { includeMetata = false; }
                    if (typeof includeFiles === "undefined") { includeFiles = false; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("UserManagement/GetUserObject", CHAOS.Portal.Client.HttpMethod.Get, { userGuid: userGuid, createIfMissing: createIfMissing, includeMetata: includeMetata, includeFiles: includeFiles }, true);
                };
                return UserManagement;
            })();
            Client.UserManagement = UserManagement;

            var UserProfile = (function () {
                function UserProfile() {
                }
                UserProfile.Get = function (metadataSchemaGuid, userGuid, serviceCaller) {
                    if (typeof userGuid === "undefined") { userGuid = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("UserProfile/Get", CHAOS.Portal.Client.HttpMethod.Get, { metadataSchemaGuid: metadataSchemaGuid, userGuid: userGuid }, true);
                };

                UserProfile.Set = function (metadataSchemaGuid, metadata, userGuid, serviceCaller) {
                    if (typeof userGuid === "undefined") { userGuid = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = CHAOS.Portal.Client.ServiceCallerService.GetDefaultCaller();

                    return serviceCaller.CallService("UserProfile/Set", CHAOS.Portal.Client.HttpMethod.Post, { metadataSchemaGuid: metadataSchemaGuid, metadata: metadata, userGuid: userGuid }, true);
                };
                return UserProfile;
            })();
            Client.UserProfile = UserProfile;
        })(Portal.Client || (Portal.Client = {}));
        var Client = Portal.Client;
    })(CHAOS.Portal || (CHAOS.Portal = {}));
    var Portal = CHAOS.Portal;
})(CHAOS || (CHAOS = {}));
var CHAOS;
(function (CHAOS) {
    (function (Portal) {
        /// <reference path="PortalClient.ts"/>
        /// <reference path="PortalExtensions.ts"/>
        (function (Client) {
            var SecureCookieHelper = (function () {
                function SecureCookieHelper() {
                }
                SecureCookieHelper.DoesCookieExist = function () {
                    return this.GetCookie() != null;
                };

                SecureCookieHelper.Login = function (callback, serviceCaller) {
                    if (typeof callback === "undefined") { callback = null; }
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    var _this = this;
                    var login = this.GetCookie();

                    if (login == null) {
                        if (callback != null)
                            callback(false);
                        return;
                    }

                    Client.SecureCookie.Login(login.Guid, login.PasswordGuid, serviceCaller).WithCallback(function (response) {
                        if (response.Error == null) {
                            _this.SetCookie(response.Body.Results[0].Guid, response.Body.Results[0].PasswordGuid, _this.COOKIE_LIFE_TIME_DAYS);
                            if (callback != null)
                                callback(true);
                        } else if (callback != null)
                            callback(false);
                    });
                };

                SecureCookieHelper.Create = function (serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    var _this = this;
                    Client.SecureCookie.Create(serviceCaller).WithCallback(function (response) {
                        if (response.Error == null)
                            _this.SetCookie(response.Body.Results[0].Guid, response.Body.Results[0].PasswordGuid, _this.COOKIE_LIFE_TIME_DAYS);
                    });
                };

                SecureCookieHelper.Clear = function () {
                    this.SetCookie("", "", -2);
                };

                SecureCookieHelper.GetCookie = function () {
                    var cookie = document.cookie;

                    if (cookie == undefined || cookie == null)
                        return null;

                    var guidRegEx = /SecureCookieGuid\=(.+?)(?:;|$)/;
                    var passwordRegex = /SecureCookiePasswordGuid\=(.+?)(?:;|$)/;

                    var result = { Guid: "", PasswordGuid: "" };
                    var match = guidRegEx.exec(cookie);

                    if (match == null)
                        return null;

                    result.Guid = match[1];

                    match = passwordRegex.exec(cookie);

                    if (match == null)
                        return null;

                    result.PasswordGuid = match[1];

                    return result;
                };

                SecureCookieHelper.SetCookie = function (guid, passwordGuid, expireInDays) {
                    var expireDate = new Date();
                    expireDate.setDate(expireDate.getDate() + expireInDays);

                    document.cookie = "SecureCookieGuid=" + (guid == null ? "" : guid) + "; expires=" + expireDate.toUTCString() + ";";
                    document.cookie = "SecureCookiePasswordGuid=" + (passwordGuid == null ? "" : passwordGuid) + "; expires=" + expireDate.toUTCString() + ";";
                };
                SecureCookieHelper.COOKIE_LIFE_TIME_DAYS = 90;
                return SecureCookieHelper;
            })();
            Client.SecureCookieHelper = SecureCookieHelper;
        })(Portal.Client || (Portal.Client = {}));
        var Client = Portal.Client;
    })(CHAOS.Portal || (CHAOS.Portal = {}));
    var Portal = CHAOS.Portal;
})(CHAOS || (CHAOS = {}));
var CHAOS;
(function (CHAOS) {
    (function (Portal) {
        (function (Client) {
            var Wayf = (function () {
                function Wayf() {
                }
                Wayf.AuthenticationType = function () {
                    return "Wayf";
                };

                Wayf.Login = function (wayfServicePath, frame, callback, serviceCaller) {
                    if (typeof serviceCaller === "undefined") { serviceCaller = null; }
                    if (serviceCaller == null)
                        serviceCaller = Client.ServiceCallerService.GetDefaultCaller();

                    if (!serviceCaller.HasSession())
                        throw new Error("Session not acquired");
                    if (wayfServicePath == null || wayfServicePath == "")
                        throw new Error("Parameter wayfServicePath cannot be null or empty");
                    if (frame == null)
                        throw new Error("Parameter frame cannot be null");

                    if (wayfServicePath.substr(wayfServicePath.length - 1, 1) != "/")
                        wayfServicePath += "/";

                    var messageRecieved = function (event) {
                        window.removeEventListener("message", messageRecieved, false);

                        var success = event.data == "success";

                        if (success)
                            serviceCaller.SetSessionAuthenticated(Wayf.AuthenticationType());

                        if (callback != null)
                            callback(success);
                    };

                    window.addEventListener("message", messageRecieved, false);

                    frame.src = wayfServicePath + "?sessionGuid=" + serviceCaller.GetCurrentSession().Guid + "&apiPath=" + serviceCaller.GetServicePath();
                };
                return Wayf;
            })();
            Client.Wayf = Wayf;
        })(Portal.Client || (Portal.Client = {}));
        var Client = Portal.Client;
    })(CHAOS.Portal || (CHAOS.Portal = {}));
    var Portal = CHAOS.Portal;
})(CHAOS || (CHAOS = {}));
