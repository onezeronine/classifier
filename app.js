var fs = require('fs');
var u = require('underscore');

/**
 * @description
 * Reads the csv file and
 *  creates a key value pair (kvp) array
 * @param {string} data
 * @return {array} array of kvp
 */
function readCsvFile(data) {
  var kvp = [];
  data.split(/\s+/).forEach(function(item) {
    if(!item) { return; }
    var k = item.split(',');
    kvp.push({
      name: k[0].toLowerCase(),
      class: k[1].toLowerCase(),
    });
  });
  var uq = u.uniq(kvp); //Keeps the key-value pair unique
  return uq;
}

/**
 * @description
 * Gets the model object
 * @param {object} model - Empty object
 * @returns {object} model
 */
function getModel(model) {
  // TODO refactor model
  model.classify = function(kvp) {
    var self = this;
    var score = {};
    self.classes.forEach(function(className) {
      var classCount = model[className].totalCount; // count(c)
      var vocabularyCount = model.totalCount; // |V|
      score[className] = {};
      score[className].value = 1;

      kvp.features.forEach(function(feature) {
        // find the feature in the model
        var selectedFeature = u.find(model[className].features,
          function(m) {
            return m.name === feature.name &&
              m.value === feature.value;
          });

        // if feature does not exists, set it to count = 0
        if(!selectedFeature) {
          selectedFeature = { count: 0 };
        }

        // compute using laplacian smoothing
        //  based on the counts
        //  then compute the product of the score
        score[className].value *= (selectedFeature.count + 1) / (classCount + vocabularyCount);
      });
    });

    // find the max score among the classes
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

/**
 * @description
 * Trains the model based on the training set and classes
 * @param {array} trainingSet - contains kvp with features
 * @param {array} classes
 * @returns {object} model
 */
function trainModel(trainingSet, classes) {
  var model = getModel({});

  //set the default value for each class in the model
  classes.forEach(function(className) {
    model[className] = { features: [], totalCount: 0 };
  });

  //set the properties for the model for used in .classify()
  model.totalCount = trainingSet.length;
  model.classes = classes;

  //collect features from training set
  trainingSet.forEach(function(kvp) {
    var features = kvp.features;
    var featureClass = model[kvp.class].features;
    model[kvp.class].totalCount += 1;

    //for each feature, set the frequency in the model
    for(var i = 0; i < features.length; ++i) {
      var selectedFeature = u.find(featureClass, function(m) {
        return m.name === features[i].name &&
          m.value === features[i].value;
      });

      if(selectedFeature) {
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

/**
 * @description
 * Evaluates the model results
 *  based on the number of classes
 * @param {object} model
 * @param {array} testSet
 * @returns {array} resulting array of the results (tp,fp,tn,fn)
 */
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

/**
 * @description
 * Extracts the features from a key value pair
 * @param {object} kvp - Key value pair
 * @returns {object} kvp with features
 */
function extractFeatures(kvp) {
  var alphabet = 'abcdefghijklmnopqrstuvwxyz';
  kvp.features = [];
  kvp.features.push({ name: 'firstLetter', value: kvp.name[0] });
  kvp.features.push({ name: 'lastLetter', value: kvp.name.slice(-1) });
  for(var i = 0; i < alphabet.length; ++i) {
    kvp.features.push({
      name: 'has(' + alphabet[i] + ')',
      value: kvp.name.indexOf(alphabet[i]) >= 0
    });
  }
  for(var j = 0; j < alphabet.length; ++j) {
    kvp.features.push({
      name: 'count(' + alphabet[j] + ')',
      value: kvp.name.split(alphabet[j]).length - 1
    });
  }
  return kvp;
}

/**
 * @description
 * Shuffles the array
 * @param {array} o
 * @returns {array} shuffled array
 */
function shuffle(o) {
  return o.sort(function() { return 0.5 - Math.random(); });
}

/**
 * @description
 * Prints the evaluation results
 * @param {array} classes
 * @param {array} result
 */
function printEvaluationResults(classes, result) {
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

  //get matrix results the model
  var result = evaluateModel(model, testSet);

  //print the precision, recall and f measure
  printEvaluationResults(classes, result);
});
