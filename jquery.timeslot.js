(function($){
	$.fn.timeslot = function(options){
		var options = $.extend({}, $.fn.timeslot.defaults, options);
		
		if( options.imageDirectory != '' ) {
			if( options.imageDirectory.charAt(options.imageDirectory.length-1) != '/' ) {
				options.imageDirectory += '/';
			}
		}
		
		
		
		var timelines = new Array();
		this.each(function(){
			var $timeline = $(this);
			
			if( $.fn.disableTextSelect != undefined ) {
				$timeline.disableTextSelect();
			}
			
			var timeline = new Timeline($timeline, options);
			timeline.build_timeline();
			timeline.init_handlers();
			
			if( typeof(options.defaultSlots) == 'object' ) {
				
				options.defaultSlots.forEach(function(time){
					timeline.set_slot(timeline.hour_to_index(time['start'])+1, timeline.hour_to_index(time['stop']), true);
				})
			}
			
			timelines.push(timeline);
		});
		
		if( timelines.length == 1 ) {
			return timelines[0];
		}
		
		return timelines;
	};
	
	$.fn.timeslot.defaults = {
		labelClass: 'label',
		hourClass: 'hour',
		quarterClass: 'quarter',
		defaultSlots: null,
		maxNumberSlot: 4,
		imageDirectory: 'images',
		/**
		 * @param from 
		 * @param to
		 * @param level
		 * @param isDefault
		 */
		onSelectSlot: function(from, to, level, event, isDefault) {},
		/**
		 * @param from
		 * @param to
		 * @param level
		 * @param isDefault
		 */
		onChangeSlot: function(from, to, level, event, isDefault) {}
	};
	
	function Timeline($timeline, options)
	{
		this.$timeline = $timeline;
		this.options = options;
		
		this.slot_began = false;
		this.$start_quarter = null;
		this.start_quarter_n = -1;
		this.$stop_quarter = null;
		this.stop_quarter_n = -1;
		this.current_level = 1;
		
		this.slot_resized = false;
		this.indicator_moving = null;
		
		// => z_indexes : level => z_index
		this.z_indexes = new Array();
	};
	
	Timeline.prototype = {
		/**
		 * Builds the html code of the timeline
		 */
		build_timeline: function() {
			
			for(var h=0; h < 24; h++) {
				$label_div= $('<div />').addClass(this.options.labelClass)
				if( h > 0 ) {
					$label_div.html(h);
				} else {
					$label_div.html('&nbsp;');
				}
				this.$timeline.append($label_div);
			}
			
			var $hr = $('<hr />').css({
				'clear': 'left',
				'visibility': 'hidden',
				'height': 0,
				'margin': 0,
				'padding': 0
			});
			this.$timeline.append($hr);
			
			for(var h=0; h < 24; h++) {
				$hour_div = $('<div />').addClass(this.options.hourClass);
				
				for(var q=0; q < 4; q++) {
					$quarter_div = $('<div />')
						.addClass(this.options.quarterClass)
						.html($('<div />'))
						.attr('rel', 1+h*4+q);
					
					$hour_div.append($quarter_div);
				}
				
				this.$timeline.append($hour_div);
			}
			
		},
		
		/**
		 * Initialiazes the handlers
		 */
		init_handlers: function() {
			var self = this;
			
			this.$timeline.find('.'+this.options.quarterClass).mousedown(function(){
				
				if( self.current_level > self.options.maxNumberSlot ) {
					return false;
				}
				
				var $quarter = $(this);
				
				if( self.slot_began == true ) {
					throw "Not supposed to append !";
				}
				
				self.slot_began = true;
				self.$start_quarter = $quarter;
				self.start_quarter_n = parseInt($quarter.attr('rel'));
				self.$stop_quarter = $quarter;
				self.stop_quarter_n = parseInt($quarter.attr('rel'));
				self.select_from_to(self.start_quarter_n, self.start_quarter_n, self.current_level);
				
			});
			
			this.$timeline.find('.'+this.options.quarterClass).mousemove(function(){
				var $quarter = $(this);
				var quarter_n = parseInt($quarter.attr('rel'));
				
				if( self.slot_began ) {
					self.$stop_quarter = $quarter;
					self.stop_quarter_n = quarter_n;
					self.select_from_to(self.start_quarter_n, quarter_n, self.current_level);
				}
			});
			
			$(document).mouseup(function(e) {
				
				if( self.slot_began == false ) {
					return;
				}
				
				if( !$(this).hasClass(self.options.quarterClass) )
					self.set_slot(self.start_quarter_n, self.stop_quarter_n);
				else {
					var $quarter = $(this);
					var quarter_n = parseInt($quarter.attr('rel'));
					self.set_slot(self.start_quarter_n, quarter_n);
				}
			});
		},
		
		/**
		 * Finalizes the slot starting from start_quarter_n and stop_quarter_n
		 *
		 * @param start_quarter_n the starting index of the slot
		 * @param stop_quarter_n the stoping index of the slot
		 * @return the level of this created slot
		 */
		set_slot: function(start_quarter_n, stop_quarter_n, isDefault) {
			var self = this;
			
			if( start_quarter_n > stop_quarter_n ) {
				var tmp = start_quarter_n;
				var start_quarter_n = stop_quarter_n;
				var stop_quarter_n = tmp;
				delete tmp;
			}
			
			var $start_quarter = self.get_quarter(start_quarter_n);
			var $stop_quarter = self.get_quarter(stop_quarter_n);
			
			var from = self.index_to_hour(start_quarter_n);
			from['index'] = start_quarter_n;
			var to = self.index_to_hour(stop_quarter_n+1);
			to['index'] = stop_quarter_n;
			var level = self.current_level;
			
			var isDefault = (isDefault != undefined && isDefault == true) ? true : false;
			if( typeof(self.options.onSelectSlot) == 'function' ) {
				self.options.onSelectSlot.call(this, from, to, level, isDefault);
			}
			
			self.add_indicator(start_quarter_n, level);
			self.add_indicator(stop_quarter_n+1, level);
			self.select_from_to(start_quarter_n, stop_quarter_n, level);
			
			self.slot_began = false;
			self.$start_quarter = null;
			self.start_quarter_n = -1;
			self.$stop_quarter_n = null;
			self.stop_quarter_n = -1;
			self.current_level += 1;
			
			return self.current_level-1;
		},

		
		/**
		 * Gets the hour related to the given index
		 *
		 * @param the index of the hour to retrieve
		 * @return the hour in an array : {'hour':*, 'minute':*} 
		 */
		index_to_hour: function(index) {
			
			var minutes = Math.floor((index % 4)-1);
			var hours = Math.floor((index - minutes)/4);
			if( minutes > 0 ) {
				minutes = 15 * minutes;
			} else if( minutes < 0 ) {
				hours -= 1;
				minutes = 60 + (15*minutes);
			}
			return {'hour':hours, 'minute': minutes};
		},
		
		/**
		 * @param time the time at with the format : hh:ii
		 * @return the index
		 */
		hour_to_index: function(time) {
			
			var infos = time.split(':');
			var hour = parseInt(infos[0]);
			var minute = parseInt(infos[1]);
			
			return hour * 4 + minute / 15;
		},
		
		/**
		 * Adds an indicator at a given position (quarter_n) for a given level
		 *
		 * @param quarter_n the index of the quarter
		 * @param level the level of the indicator to add
		 */
		add_indicator: function(quarter_n, level) {
			var self = this;
			
			var $indicator = $('<img />')
				.attr('src', self.options.imageDirectory+'indicator_level'+level+'.gif')
				.addClass('indicator'+level).attr('rel', level);
			
			
			this.$timeline.append($indicator);

			var $quarter = this.get_quarter(quarter_n);
			$indicator.load(function() {
				
				$indicator.addClass('indicator');
				
				var left = $quarter.position().left - $indicator.width()/2;
				var top = self.$timeline.height();
				
				$indicator.css({
					'left': left+'px',
					'top': top+'px'
				})
				
			});
			
			
			$indicator.mousedown(function() {
				var z_index = self.set_max_z_index(level);
				
				self.get_quarters(level).css('z-index', z_index);
				
				self.slot_resized = true;
				self.indicator_moving = $(this);
				
			});
			
			$(window).mousemove(function(e) {
				if( self.slot_resized != true ) {
					return;
				}

				var timeline_left = self.$timeline.offset().left;
				var posX = e.pageX-timeline_left;
				
				var $new_quarter = self.position_to_quarter(posX);
				var new_quarter_n = parseInt($new_quarter.attr('rel'));
				self.indicator_moving.css('left', $new_quarter.position().left - self.indicator_moving.width()/2);
				
				self.select_between_indicators(level);
				
			});
			
			$(window).mouseup(function() {
				if( self.slot_resized == true ) {
					self.slot_resized = false;
					
					var level = parseInt(self.indicator_moving.attr('rel'));
					
					var $start_quarter = self.get_first_quarter(level).parent('div');
					var start_quarter_n = parseInt($start_quarter.attr('rel'));
					
					var $stop_quarter = self.get_last_quarter(level).parent('div');
					var stop_quarter_n = parseInt($stop_quarter.attr('rel'));
					
					var from = self.index_to_hour(start_quarter_n);
					from['index'] = start_quarter_n;
					var to = self.index_to_hour(stop_quarter_n+1);
					to['index'] = stop_quarter_n;
					var isDefault = false;
					
					if( typeof(self.options.onSelectSlot) == 'function' ) {
						self.options.onChangeSlot.call(this, from, to, level, isDefault);
					}
					
					
					self.indicator_moving = null;
				}
			});
			
		},
		
		select_between_indicators: function(level) {
			var indicators = this.get_indicators(level);
			
			var start_index = this.position_to_index(indicators[0].position().left + indicators[0].width()/2);
			var stop_index = this.position_to_index(indicators[1].position().left + indicators[1].width()/2) - 1;
			
			this.select_from_to(start_index, stop_index, level);
		},
		
		get_indicators: function(level) {
			var indicators = new Array();
			this.$timeline.find('.indicator'+level).each(function(){
				indicators.push($(this));
			});
			
			if( indicators.length > 2 ) {
				throw "More than 2 indicators..."
			}
			
			if( indicators[0].position().left > indicators[1].position().left ) {
				var tmp = indicators[0];
				indicators[0] = indicators[1];
				indicators[1] = tmp;
				delete tmp;
			}
			
			return indicators;
		},
		
		position_to_index: function(posX) {
			return parseInt(this.position_to_quarter(posX).attr('rel'));
		},
		
		position_to_quarter: function(posX) {
			var self = this;
			
			var $new_quarter = null;
			var consider_next = false;
			self.$timeline.find('.'+self.options.quarterClass).each(function(){
				var $current_quarter = $(this);
				
				if( consider_next ) {
					$new_quarter = $current_quarter;
					consider_next = false;
				}
				
				if( $current_quarter.position().left	<= posX ) {
					$new_quarter = $current_quarter;
					consider_next = true;
				}
				
			});
			
			return $new_quarter;
		},
		
		/**
		 *
		 */
		get_first_quarter: function(level) {
			return this.get_quarters(level).first();
		},
		
		get_last_quarter: function(level) {
			return this.get_quarters(level).last();
		},
		
		/**
		 * Gets the z-index index of a level
		 *
		 * @param level the level
		 * @return the z-index or null if there is ot
		 */
		get_z_index: function(level) {
			if( level in this.z_indexes ) {
				return this.z_indexes[level];
			}
			return null;
		},
		
		/**
		 * Sets the z-index of a level.
		 * Warn : it's just update the z_indexes array but not the real
		 *		z-index css
		 * @param level the level
		 * @param z_index the new z-index
		 */
		set_z_index: function(level, z_index) {
			this.z_indexes[level] = z_index;
		},
		
		/**
		 * Sets the maximum z-index to a level.
		 *
		 * @param level
		 * @return the z-index set on this level
		 */
		set_max_z_index: function(level) {
			
			var z_index_level = this.get_z_index(level);
			var max_z_index = 0;
			
			this.z_indexes.forEach(function(z_index){
				max_z_index = Math.max(max_z_index, z_index);
			});

			if( max_z_index == z_index_level ) {
				return max_z_index;
			}
			
			this.set_z_index(level, max_z_index+1);
			
			return max_z_index+1;
		},
		
		/**
		 * Gets the quarter at a given index
		 *
		 * @param index the given index
		 * @return the quarter
		 */
		get_quarter: function(index) {
			return this.$timeline.find('[rel='+index+']');
		},
		
		/**
		 * Get the quarter of a level
		 *
		 * @param level : the level
		 * @return the quarters
		 */
		get_quarters: function(level) {
			var level_class = 'level'+level;
			return this.$timeline.find('.'+level_class);
		},
		
		/**
		 * Select the quarters with the rel attribute between "from" and "to" arguments
		 * the level of selection is given by the third argument.
		 * If a selection is already made with this level, it will be automatically removed
		 * "from" argument can be greater that "to" argument (selection is reversed).
		 *
		 * @param from : the index of the first quarter to select
		 * @param to : the index of the last quarter to select
		 * @param level : the level of selection
		 */
		select_from_to: function(from, to, level) {
			var self = this;

			if( typeof(from) != 'number' ) {
				throw "Type of 'from' argument is "+typeof(from)+". number espected";
			}
			
			if( typeof(to) != 'number' ) {
				throw "Type of 'to' argument is "+typeof(from)+". number espected";
			}
			
			// Ensures that from index is smaller that to index.
			if( from > to ) {
				var tmp = from;
				from = to;
				to = tmp;
				delete tmp;
			}

			// Removes unselect quarter of this level
			self.unselect(level);
			
			var level_class = 'level'+level;
			var z_index = this.get_z_index(level);
			if( z_index == null ) {
				z_index = this.set_max_z_index(level);
			}
			
			for(var i=from; i <= to; i++) {
				var div = $('<div />').addClass(level_class).css('z-index', z_index);
				self.get_quarter(i).append(div);
			}
		},
		
		/**
		 * Unselect quarter selected with the given level
		 * 
		 * @param level the level to consider
		 */
		unselect: function(level, hideIndicators) {
			var level_class = 'level'+level;
			this.$timeline.find('.'+level_class).remove();
			if( hideIndicators == true ) {
				this.$timeline.find('.indicator'+level).remove();
			}
		},
	
		/**
		 * Clear all informations
		 */
		clear: function() {
			
			//this.$timeline.find('div').remove();

			this.slot_began = false;
			this.$start_quarter = null;
			this.start_quarter_n = -1;
			this.$stop_quarter = null;
			this.stop_quarter_n = -1;
			this.current_level = 1;

			this.slot_resized = false;
			this.indicator_moving = null;

			// => z_indexes : level => z_index
			this.z_indexes = new Array();
		}
	};
	
})(jQuery);