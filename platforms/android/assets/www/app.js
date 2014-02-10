// Misc helper functions 

var lastDoneDaysToOptionValue = function (lastDone) {
  var value;
  if (lastDone < 2) {
    value = lastDone;
  } else if (lastDone <= 7) {
    value = 5;
  } else if (lastDone <= 14) {
    value = 10;
  } else if (lastDone <= 30) {
    value = 23;
  } else if (lastDone <= 65) {
    value = 45;
  } else {
    value = 9999;
  }
  return value;
}

var timeStampToDaysAgo = function (time) {
  return Math.floor(((new Date).getTime() - time)/86400000);
}



// Templates

var templates = {
  createActionView: function () {
    var templateElem = document.querySelector('#edit-card-template');
    var template = _.template(templateElem.innerHTML);
    return template({title: '', lastDone: 0, targetFrequency: 7, primaryActionText: 'Create', primaryActionClass: 'create', hasSecondaryAction: false});
  },

  editActionView: function (attr) {
    var templateElem = document.querySelector('#edit-card-template');
    var template = _.template(templateElem.innerHTML);

    var lastDoneDays = lastDoneDaysToOptionValue(timeStampToDaysAgo(attr.lastDone));
    var targetFrequency = attr.targetFrequency;

    return template({title: attr.title, lastDone: lastDoneDays, targetFrequency: targetFrequency, primaryActionText: 'Done', primaryActionClass: 'save', hasSecondaryAction: true, secondaryActionText: 'Remove', secondaryActionClass: 'remove'});
  },

  actionView: function (attr) {
    var templateElem = document.querySelector('#card-template');
    var template = _.template(templateElem.innerHTML);

    var lastDoneDays = timeStampToDaysAgo(attr.lastDone);
    var lastDoneString;
    if (lastDoneDays === 0) {
      lastDoneString = 'Done today';
    } else if (lastDoneDays === 1) {
      lastDoneString = 'Done yesterday';
    } else if (lastDoneDays <= 7) {
      lastDoneString = 'Done within the last week';
    } else if (lastDoneDays <= 14) {
      lastDoneString = 'Done last week';
    } else if (lastDoneDays <= 30) {
      lastDoneString = 'Done this month';
    } else if (lastDoneDays <= 60) {
      lastDoneString = 'Done 1 month ago';
    } else if (lastDoneDays <= 365) {
      lastDoneString = Math.floor(lastDoneDays/30) + ' months ago';
    } else {
      lastDoneString = 'Not done in living memory'
    }

    var markDoneEnabled = (lastDoneDays !== 0);

    return template({title: attr.title, lastDone: lastDoneString, primaryActionText: 'Mark done', primaryActionClass: 'done', hasSecondaryAction: false, markDoneEnabled: markDoneEnabled});
  },

  dividerView: function (attr) {
    var templateElem = document.querySelector('#divider-template');
    var template = _.template(templateElem.innerHTML);
    return template(attr);
  }
};



// Models

var Action = Backbone.Model.extend({
  initialize: function () {
    this.bind('change:lastDone', this.resortCollection, this);
    this.bind('change:targetFrequency', this.resortCollection, this);
  },
  defaults: {
    'title': '',
    'lastDone': (new Date).getTime(),
    'targetFrequency': 1,
    'beingEdited': false,
    'active': false
  },
  setLastDoneNDaysAgo: function (days) {
    this.save({lastDone: (new Date).getTime()-86400000*days});
  },
  done: function () {
    this.save({lastDone: (new Date).getTime()});
  },
  resortCollection: function () { 
    this.collection.sort();
  },
  score: function () {
    return timeStampToDaysAgo(this.get('lastDone'))/this.get('targetFrequency');
  }
});

var ActionCollection = Backbone.Collection.extend({
  initialize: function () {
    // this.bind('', this.refreshActive, this);
  },
  model: Action,
  localStorage: new Backbone.LocalStorage('ActionCollection'), 
  comparator: function(a,b) {
    return a.score() > b.score() ?  -1
         : a.score() < b.score() ?  1
         :                    0;
  }
});



// Views

ActionListView = Backbone.View.extend({
  initialize: function () {
    this.model.bind('reset', this.clearAndRender, this);
    this.model.bind('sort', this.clearAndRender, this);
    this.model.bind('add', this.clearAndRender, this);
    this.model.bind('remove', this.clearAndRender, this);
  },
  el: '#cards',
  clearAndRender: function () {
    this.el.innerHTML = '';
    this.render();
  },
  render: function (event) {

    // Display 'this week' divider
    var dividerElem = document.createElement('div');
    dividerElem.innerHTML = templates.dividerView({text: 'This week'});
    document.querySelector('#cards').appendChild(dividerElem);

    var shownDivider = false;
    _.each(this.model.models, function (action) {
      if (action.score() < 0.9 && !shownDivider) {
        shownDivider = true;
        // Display 'this week' divider
        var dividerElem = document.createElement('div');
        dividerElem.innerHTML = templates.dividerView({text: 'Later'});
        document.querySelector('#cards').appendChild(dividerElem);
      }

      var actionView = new ActionView({model: action});
      actionView.render();
    });
  }
});

var ActionView = Backbone.View.extend({
  initialize: function () {
    this.listenTo(this.model, "change", this.render);
    document.querySelector('#cards').appendChild(this.el);
    this.editActionView = new EditActionView({model: this.model, el: this.el});
    this.viewActionView = new ViewActionView({model: this.model, el: this.el});
  },

  render: function () {
    if (this.model.attributes.beingEdited) {
      this.editActionView.render();
    } else {
      this.viewActionView.render();
    }
  }
});

var ViewActionView = Backbone.View.extend({
  template: templates.actionView,

  events: {
    'click .card-action.done': 'markDone',
    'click .menu': 'edit'
  },

  render: function () {
    this.el.innerHTML = this.template(this.model.attributes);
  },

  markDone: function () {
    this.model.done();
    document.querySelector('#win-audio').play();
  },

  edit: function () {
    this.model.set('beingEdited', true);
  }
});

var EditActionView = Backbone.View.extend({
  id: function () { 'edit-card-' + this.model.cid },

  template: templates.editActionView,

  events: {
    'click .card-action.save': 'saveChange',
    'click .card-action.remove': 'removeModel'
  },

  render: function () {
    this.el.innerHTML = this.template(this.model.attributes);
  },

  saveChange: function () {
    var titleElem = this.el.querySelector('.title-input');
    var lastDoneElem = this.el.querySelector('select[name="last-completed"]');
    var targetFrequencyElem = this.el.querySelector('select[name="target-frequency"]');
    var title = titleElem.value;
    var targetFrequency = parseInt(targetFrequencyElem.options[targetFrequencyElem.selectedIndex].value);
    // Get the new value and only update the model if it's different to the old value
    var newLastDone = parseInt(lastDoneElem.options[lastDoneElem.selectedIndex].value);
    var currentLastDone = lastDoneDaysToOptionValue(timeStampToDaysAgo(this.model.attributes.lastDone));
    if (currentLastDone != newLastDone) {
      this.model.setLastDoneNDaysAgo(newLastDone);
    }
    this.model.save({'title': title, 'targetFrequency': targetFrequency, beingEdited: false});
  },

  removeModel: function () {
    this.model.destroy();
  }
});

var CreateActionView = Backbone.View.extend({
  el: '#create-section',

  template: templates.createActionView,

  render: function () {
    // cardElem.querySelector('.title-input').focus();
    this.el.innerHTML = this.template();
  },

  events: {
    'click .card-action.create': 'create'
  },

  create: function () {
    // Read values to enable creation
    var titleElement = this.el.querySelector('.title-input');
    var lastDoneElem = this.el.querySelector('select[name="last-completed"]');
    var targetFrequencyElem = this.el.querySelector('select[name="target-frequency"]');
    var title = titleElement.value;
    var lastDone = parseInt(lastDoneElem.options[lastDoneElem.selectedIndex].value);
    var targetFrequency = parseInt(targetFrequencyElem.options[targetFrequencyElem.selectedIndex].value);
    var a = new Action({title: title, targetFrequency: targetFrequency});
    actionCollection.create(a);
    // Find a way to add this earlier so we don't have to rerender. We can't stick it above because a model must be added to a collection before saving
    a.setLastDoneNDaysAgo(lastDone);
    setCreateMode(false);
  },

  show: function () {
    // TODO: potentially avoid this render
    this.render();
    this.$el.show();
  },

  hide: function () {
    this.$el.hide();
  }
});

// Now do stuff with it!

var actionCollection = new ActionCollection();
actionCollection.fetch({
    success:function () {
        actionListView = new ActionListView({model:actionCollection});
        actionListView.render();
    }
});

var createActionView = new CreateActionView();;
var setCreateMode = function (bool) {
  if (bool) {
    createActionView.show();
    var createButtonElem = document.querySelector('#create-button');
    createButtonElem.style.display = 'none';
  } else {
    createActionView.hide();
    var createButtonElem = document.querySelector('#create-button');
    createButtonElem.style.display = 'block';
  }
}

var createButtonElem = document.querySelector('#create-button');
createButtonElem.onclick = function () {
  setCreateMode(true);
}