columnHeight = $(window).height()-100;
columnWidth = 150;

// TODO: nest variables and functions into an object, so there's no accidental overloading when using this as a library

function init() {
	// button for adding columns
	columns = d3.select("#left").append("select").attr("onchange", "drawColumn(this);");
	columns.append("option").attr("value", "none").attr("disabled","disabled").append("tspan").html("draw column");
	columns.selectAll("columns").data(dataStructure).enter().append("option").attr("value", function(column, i) {
			return i;
		}).append("tspan").html(function(column) {
			return column.name;
		});
	columns.selectAll("option").filter(function(d) {
		return (undefined!=d && d.type=="id");
	}).attr("disabled","disabled"); // disable columns of type id (or maybe remove?)
}

// TODO: call repaint on window resize (and set column height)

function repaintColumn(index) {
	// TODO: this is redundant.
	var svg = d3.select(".column.index"+index);
	var scale = getScale(index);
	scale.range([columnHeight, 0]);
	svg.select("g.axis").remove();
	var axis = d3.svg.axis()
	    .scale(scale)
	    .orient("left")
	    .ticks(20);
	svg.append("g").attr("transform", "translate(40,0)").attr("class","axis").call(axis);
	// recalculate cy
	// TODO: css transitions	
	svg.selectAll("circle").attr("cy", function(d) {return Math.round(scale(d[index]));});
	// TODO: give circles a flag for the repaint process so I can differentiate between recalculated and not recalculated cx value for same
	
}

function drawColumn(select) {
	// TODO: make g for data points with offset for axis and later controls and labels
	// TODO: output column names and, if set, unit
	// TODO: split into functions
	var index = select.value;
	select.value = "none"; // reset select
	if (d3.select(".column.index"+index).size()>0) return; // return if column already drawn
	var svg = d3.select("body").append("svg").attr("width",columnWidth).attr("height",columnHeight).attr("class","column index"+index); // TODO: write index in a different attribute
	var scale = getScale(index);
	// make axis
	var axis = d3.svg.axis()
	    .scale(scale)
	    .orient("left")
	    .ticks(20); // TODO: ticks will probably be dependent on data type
	// TODO: draw boundaries if applicable
	svg.append("g").attr("transform", "translate(40,0)").attr("class","axis").call(axis); // TODO: what if labels are wider than 40px? big numbers?
	// draw data
	// TODO: call append on requestAnimationFrame for large data
	// TODO: implement arrays - drawing more than one circle per dataset
	svg.selectAll("cell").data(data).enter().append("circle")
		.attr("r",3) // TODO: make dependent data density
		.attr("cy", function(d) {return Math.round(scale(d[index]));})
		.attr("cx", function(d) {
			// approximate distribution of cells over x axis
			// TODO: refine placement on requestAnimationFrame
			var y = Math.round(scale(d[index]));
			// get all cells that are already placed around the same y value
			var same = svg.selectAll("circle[cx]").filter(function(d) {
					return Math.abs(Math.round(scale(d[index])-y))<4;
				});
			var side = (same.size()%2)*2-1;
			return (columnWidth-50)/2 +50 + 7 * Math.ceil(same.size()/2) * side; // TODO: except if too wide! What then? make smaller circles bzw. less alpha
			// TODO: title attribute, hover
		});
}


// get the appropriate scale for the data type
// TODO: ALL THIS IS SHIT, because I need to know all data beforehand, and what if I have tons of data that takes seconds to process? change scale with new data point if necessary
function getScale(index) {
	switch(dataStructure[index].type) {
		case "float": var max = d3.max(data, function(row) {
			  return row[index];
			});
			var min = d3.min(data, function(row) {
			  return row[index];
			});
			var domain = max-min;
			max = max + domain * 0.05;
			if (min>0 && min<domain * 0.1) {min=0;} else {min = min - domain * 0.05;}
			return d3.scale.linear().domain([min,max]).range([columnHeight,0]);;
			break;
		case "int": var max = d3.max(data, function(row) { // same as for float, but with rounded min and max values
			  return row[index];
			});
			var min = d3.min(data, function(row) {
			  return row[index];
			});
			var domain = max-min;
			max = Math.ceil(max + domain * 0.05);
			if (min>0 && min<domain * 0.1) {min=0;} // if minimum value is close to zero, start the scale at zero
			else {min = Math.floor(min - domain * 0.05);}
			return d3.scale.linear().domain([min,max]).range([columnHeight,0]);;
			break;
		case "enum": 
			// TODO: nonono ordinal scales, because rangeRoundBands will all be the same height instead of proportional.
			var domain = data.map(function(d) {
				return d[index]; 
			});
			var clean = domain.keys();
			return d3.scale.ordinal().domain(domain.keys()).rangeRoundBands([columnHeight, 0]);
			break;
	}
}

// TODO: dynamic number of datasets
// TODO: dynamically responding to window size
// TODO: optional adding group boundaries to floats and ints, or gradients, or colors
// TODO: dynamic output of grouped data for chart drawing (probably) (later)

init();
