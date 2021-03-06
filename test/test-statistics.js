/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { components } = require("chrome");
const BinaryOutputStream = components.Constructor("@mozilla.org/binaryoutputstream;1", "nsIBinaryOutputStream", "setOutputStream");
const BinaryInputStream = components.Constructor("@mozilla.org/binaryinputstream;1", "nsIBinaryInputStream", "setInputStream");
const { StatisticsReporter } = require("statistics"),
      { SearchEngines, SearchEngine } = require("search-engines");

const ExampleSearchEngine = SearchEngine("http://www.example.com/opensearch",
                                         "Example Search",
                                         "http://www.example.com/search?q={searchTerms}",
                                         "http://www.example.com/search_suggest?q={searchTerms}",
                                         "http://www.example.com/favicon.ico");

require("observer-service").notify("search:debug", true);

exports.testUsage = function(test) {
  // Make the reporter send out stats every second
  StatisticsReporter.timeout = 1000 * 1;

  var stat = ExampleSearchEngine.toJSON();
      stat["order"] = 0;
      stat["suggestions"] = 3;
      stat["index"] = 0;

  let server = require("httpd").startServerAsync(8080);
  server.registerPathHandler("/service", function handle(request, response) {
    response.setHeader("Content-Type", "application/json");
    var body = "",
        bodyStream = new BinaryInputStream(request.bodyInputStream),
        bytes = [],
        avail = 0;
    while ((avail = bodyStream.available()) > 0) {
      body += String.fromCharCode.apply(String, bodyStream.readByteArray(avail));
    }

    var parsed = require("querystring").parse(body),
        obj = JSON.parse(parsed.data);

    obj.data.forEach(function(item) {
      var engine = JSON.parse(item.engine);
      //console.log("action", item.action);
      //console.log("engine", engine.name);
      if (item.stats) {
        if (ExampleSearchEngine.id == engine.id) {
          var stat0 = JSON.parse(item.stats)[0];
          test.assertNotStrictEqual(stat, stat0, engine.name + " statistic was sent correctly");
        }
      }
    })
    response.write("");
    server.stop(function() { test.done(); });
  });
  StatisticsReporter.send("use", ExampleSearchEngine, [stat]);
  test.waitUntilDone(15 * 1000);
}
