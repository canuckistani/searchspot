/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Trait } = require('traits'),
      { EventEmitter } = require("events");

// Note we're using the modified "simpler-storage" which purges on disable
const SimpleStorage = require("simpler-storage"),
      storage = SimpleStorage.storage,
      xhr = require("xhr"),
      timers = require("timers"),
      simpleprefs = require("simple-prefs");

const ALLOW_STATISTICS_PREF = "allowStatisticsReporting";
const STATISTICS_URL_PREF = "statisticsReportingURL";

const StatisticsReporter = EventEmitter.compose({
  _emit: EventEmitter.required,
  on: EventEmitter.required,

  get url() "http://localhost:8080/service",

  _timer : null,
  get timer() this._timer,
  set timer(timer) {
    if (this.timer != null) {
      timers.clearTimeout(this.timer);
    }
    this._timer = timer;
  },

  _allowed : false,

  // It's the callers responsibility to actually put this question up to the user
  // Once this is set statistics will begin gathering and automatically sent
  get allowed() this._allowed,
  set allowed(allow) this._allowed = simpleprefs.prefs[ALLOW_STATISTICS_PREF] = allow,

  // If the pref changes run the monitor function which will turn on or off as needed
  _onallowed : function(subject) {
    this._setTimer();
  },

  _stats : [],

  constructor : function StatisticsReporter() {
    if (!storage.stats) {
      storage.stats = [];
    } else {
      this._stats = storage.stats;
    }

    // XXX You don't have a choice just yet
    this.allowed = true;

    simpleprefs.on(ALLOW_STATISTICS_PREF, this._onallowed.bind(this), this);

    this._setTimer();

    SimpleStorage.on("OverQuota", this._overQuota.bind(this));
    require("unload").ensure(this);
  },

  _setTimer : function _setTimer() {
    console.log("_setTimer", this.allowed, this.timer);
    if (this.allowed && this.timer == null) {
      this.timer = timers.setInterval(this._run.bind(this), 1 * 1000);
    } else {
      this.timer = null;
    }
    console.log("_setTimer", this.allowed, this.timer);
  },

  send : function send(stats) {
    console.log("send", this.allowed, this.timer);
    if (this.allowed) {
      console.log("stats", JSON.stringify(stats), JSON.stringify(this._stats));
      this._stats.push(stats);
    }
  },


  // Runs the XHR calls to the engines.
  _run : function () {
    console.log("pre._run", this._stats.length, JSON.stringify(this._stats));

    // only run if we have stats to send
    if (this._stats.length <= 0) {
      return;
    }

    console.log("_run", this._stats.length, JSON.stringify(this._stats));

    var data = JSON.stringify(this._stats);
    this._stats = [];

    this._xhr(this.url, data, function(req) {
      try {
        console.log(data, req);
      } catch (error) { console.error("xhr error: " + error + "\n"); }
    }.bind(this));

  },

  // Runs an XHR and calls callback with the XHR request that successfully
  // completes.
  _xhr: function (url, data, callback) {
      var req = new xhr.XMLHttpRequest();
      req.open('POST', url, true);
      req.setRequestHeader('Content-type',"application/x-www-form-urlencoded");
      req.setRequestHeader("Connection", "close");
      req.onreadystatechange = function (aEvt) {
        if (req.readyState == 4) {
          if (req.status == 200) {
            console.info('req.info', req.readyState, req.status, req.statusText, url);
            callback(req);
          } else {
          }
        }
      };
      req.send("data="+data);
      return req;
  },

  unload : function unload(reason) {
    this.timer = null;
    storage.stats = this._stats;
    SimpleStorage.removeListener("OverQuota", this._overQuota);
  },

  // XXX Totally untested
  _overQuota: function _overQuota() {
    //while (SimpleStorage.quotaUsage > 1) {
    //  storage.engines;
    //}
    console.error("_overQuota");
  }

})();


exports.StatisticsReporter = StatisticsReporter;
