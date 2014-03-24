var neo4j = require("neo4j");
//var db = new neo4j.GraphDatabase("http://codemap:kOITyJ5vrvCQDF9N8ybB@codemap.sb01.stations.graphenedb.com:24789");
var db = new neo4j.GraphDatabase('http://localhost:7474');

var Skill = require('./skill');

var INDEX_NAME = 'nodes';
var INDEX_KEY = 'type'; 
var INDEX_VAL = 'person';
var SKILL_INDEX_VAL = 'skill';
var relationType = 'none';
var skillRelation = 'knows';

var Person = module.exports = function Person(_node) {
    this._node = _node;
}


Object.defineProperty(Person.prototype, 'id', {
    get: function() { return this._node.id; }
});

Object.defineProperty(Person.prototype, 'exists', {
    get: function() { return this._node.exists; }
});

Object.defineProperty(Person.prototype, 'title', {
    get: function() { return this._node.data['title']; },
    set: function(title) { this._node.data['title'] = title; }
});

Object.defineProperty(Person.prototype, 'url', {
    get: function() { return this._node.data['url']; },
    set: function(url) { this._node.data['url'] = url; }
});

Person.prototype._getSkills = function(other, callback) {
    var query = [
        'START person=node({personId}), other=node({otherId})',
        'OPTIONAL MATCH (person) -[rel:GENERIC_REL]-> (other)',
        'RETURN rel'
    ].join('\n')
        .replace('GENERIC_REL', skillRelation);

    var params = {
        personId: this.id,
        otherId: other.id
    }

    db.query(query, params, function(err, res) {
        if(err) return callback(err);
        var rel = res[0] && res[0]['rel'];
        callback(null, rel);
    });
};

Person.prototype.save = function(callback) {
    this._node.save(function(err) {
        callback(err);
    });
};

Person.prototype.relate = function(other, callback) {
    //Where should this logic live?
    //Relationship hash => this type + that type -> rel_type
    //if node.type && other.type == "person"  => friends
    //if node.type && other.type => friends
    this._node.createRelationshipTo(other._node, skillRelation, {}, function(err, rel) {
        callback(err);
    });
};

Person.prototype.save = function (callback) {
    this._node.save(function (err) {
        callback(err);
    });
};

Person.prototype.getSkills = function(callback) {
    var query = [
        'START person=node({personId}), other=node:INDEX_NAME(INDEX_KEY="INDEX_VAL")',
        'OPTIONAL MATCH (person) -[rel:GENERIC_REL]-> (other)',
        'RETURN other, COUNT(rel)'
    ].join('\n')
        .replace('INDEX_NAME', INDEX_NAME)
        .replace('INDEX_KEY', INDEX_KEY)
        .replace('INDEX_VAL', SKILL_INDEX_VAL)
        .replace('GENERIC_REL', skillRelation);

    var params = {
        personId: this.id,
    };

    var person = this;
    db.query(query, params, function(err, res) {
        if(err) return callback(err);

        var relatives = [];
        var others = [];

        for(var i=0; i < res.length; i++) {
            var other = new Skill(res[i]['other']); 
            var relates = res[i]['COUNT(rel)'];
            if(person.id === other.id) {
                continue;
            } else if (relates){
                relatives.push(other);
            } else {
                others.push(other);
            }
        }

        callback(null, relatives, others);
    });
};

Person.get = function(id, callback) {
    db.getNodeById(id, function(err, node) {
        if(err) return callback(err);
        callback(null, new Person(node));
    });
};

Person.getAll = function(callback) {
    db.getIndexedNodes(INDEX_NAME, INDEX_KEY, INDEX_VAL, function(err, nodes) {
        if(err) {
            if(err.message.match(/Neo4j NotFoundException/i)) {
                return callback(null, []);
            } else {
                return callback(err);
            }
        }
        var persons = nodes.map(function(node) {
            return new Person(node);
        });
        callback(null, persons);
    });
}

Person.getPeopleWithSkills = function(callback) {
    var query = [
        'MATCH (person)-[:knows]->(skill)',
        'RETURN person AS Person, collect(skill) AS SkillList;'
      ].join('\n')
       .replace('GENERIC_REL', skillRelation);

    var params = {};

    db.query(query, params, function(err, res) {
        if(err) {
                if(err.message.match(/Neo4j NotFoundException/i)) {
                    return callback(null, []);
                } else {
                    return callback(err);
                }
        }
        var results = res[0];

        var people = res.map(function(result) {
            var person = new Person(result['Person']);

            var skillNodes = result['SkillList'];
            var skills = skillNodes.map(function(node) {
                return new Skill(node);
            });
            person.skills = skills;

            return person;
        });
        //var persons = res[0] && res[0]['rel'];
        callback(null, people);
    });
};



Person.create = function(data, arg, callback) {
    console.log("Person creation data:");
    console.log(data);
    var node = db.createNode(data);
    var person = new Person(node);
    node.save(function(err) {
        if(err) return callback(err);
        node.index(INDEX_NAME, INDEX_KEY, INDEX_VAL, function(err) {
            if(err) return callback(err);
            callback(null, person, arg);
        });
    });
};





