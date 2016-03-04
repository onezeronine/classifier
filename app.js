var fs = require('fs');
var u = require('underscore');

function readCsvFile(data) {
  var kvp = [];
  data.split('\r\n').forEach(function(item) {
    if(!item) { return; }
    var k = item.split(',');
    kvp.push({
      name: k[0].toLowerCase().replace(/\s+/, ''),
      class: k[1].toLowerCase().replace(/\s+/, ''),
    });
  });
  var uq = u.uniq(kvp);
  return uq;
}

function getModel(model) {
  model.classify = function(kvp) {
    var self = this;
    var score = {};
    model.classes.forEach(function(className) {
      var classCount = model[className].totalCount; // count(c)
      var vocabularyCount = model.totalCount; // |V|
      score[className] = {};
      score[className].value = 1;

      kvp.features.forEach(function(feature) {
        var selectedFeature = u.find(model[className].features, function(m) {
          return m.name === feature.name && m.value === feature.value;
        });
        if(!selectedFeature) {
          selectedFeature = { count: 0 };
        }
        score[className].value *= (selectedFeature.count + 1) / (classCount + vocabularyCount);
      });

    });

    var max = 0;
    var selectedClass = null;
    for(var property in score) {
      if(score.hasOwnProperty(property)) {
        if(score[property].value > max) {
          selectedClass = property;
          max = score[property].value;
        }
      }
    }
    return selectedClass;
  };
  return model;
}

function trainModel(trainingSet, classes) {
  var model = getModel({});
  model.classes = classes;
  classes.forEach(function(cls) {
    model[cls] = { features: [], totalCount: 0 };
  });
  model.totalCount = trainingSet.length;

  //collect features from training set
  trainingSet.forEach(function(kvp) {
    var features = kvp.features;
    var featureClass = model[kvp.class].features;
    model[kvp.class].totalCount += 1;

    for(var i = 0; i < features.length; ++i) {
      var selectedFeature = u.find(featureClass, function(m) {
        return m.name === features[i].name && m.value === features[i].value;
      });

      if(selectedFeature)   {
        selectedFeature.count += 1;
      } else {
        var obj = features[i];
        obj.count = 1;
        featureClass.push(obj);
      }
    }
  });

  return model;
}

function evaluateModel(model, testSet) {
  var matrix = {};
  model.classes.forEach(function(c) {
    matrix[c] = {};
    model.classes.forEach(function(c2) {
      matrix[c][c2] = 0;
    });
  });
  testSet.forEach(function(kvp) {
    var assignedClass = model.classify(kvp);
    var trueClass = kvp.class;
    matrix[trueClass][assignedClass] += 1;
  });
  return matrix;
}

function extractFeatures(kvp) {
  var alphabet = 'abcdefghijklmnopqrstuvwxyz';
  kvp.features = [];
  kvp.features.push({ name: 'firstLetter', value: kvp.name[0] });
  kvp.features.push({ name: 'lastLetter', value: kvp.name.slice(-1) });
  for(var i = 0; i < alphabet.length; ++i) {
    kvp.features.push({ name: 'has(' + alphabet[i] + ')', value: kvp.name.indexOf(alphabet[i]) >= 0 });
  }
  for(var j = 0; j < alphabet.length; ++j) {
    kvp.features.push({ name: 'count(' + alphabet[j] + ')', value: kvp.name.split(alphabet[j]).length - 1 });
  }
  return kvp;
}

function shuffle(o) {
  return o.sort(function() { return 0.5 - Math.random(); });
}

// MAIN ENTRY OF APP
fs.readFile('names.csv', 'utf-8', function(err, data) {
  if(err) { throw err; }
  var pairs = shuffle(readCsvFile(data));
  var classes = u.uniq(u.map(pairs, function(p) { return p.class; }));
  var n = Math.floor((pairs.length / 5) * 4);

  //extract features
  pairs.forEach(function selectFeature(kvp) {
    kvp = extractFeatures(kvp);
  });

  //divide kvp into two sets: training, test
  var trainingSet = pairs.slice(0, n);
  var testSet = pairs.slice(n, pairs.length);

  //train the model
  var model = trainModel(trainingSet, classes);

  //evaluate the model
  var result = evaluateModel(model, testSet);

  classes.forEach(function(className) {
    var numerator = result[className][className];
    var precisionDenominator = 0;
    var recallDenominator = 0;
    for(var i = 0; i < classes.length; ++i) {
      precisionDenominator += result[classes[i]][className];
      recallDenominator += result[className][classes[i]];
    }
    var precision = (numerator / precisionDenominator);
    var recall = (numerator / recallDenominator);
    var f = (2 * precision * recall) / (precision + recall);
    console.log('Precision(' + className + ') => ' + precision);
    console.log('Recall(' + className + ') => ' + recall);
    console.log('F(' + className + ') => ' + f);

  });
});
