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
	// tooltip div
	d3.select("body").append("div").attr("class", "tooltip");
}

// TODO: call repaint on window resize (and set column height)
/*
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
*/

function drawCell(data, svg) {
	var radius = svg.attr("radius");
	var index = svg.attr("index");
	// check if scale is set and still correct
	checkScale(dataStructure[index], data[index], svg);
	var scale = dataStructure[index].scale;
	var row = 0;
	// row id is the first column of type id
	// TODO: if no id, return index of row
	for (var i=0;i<dataStructure.length;i++) {
		if (dataStructure[i].type=="id") row = data[i];
	}
	d3.select("svg[index='"+index+"'] .chart").append("circle")
		.attr("r",radius) // TODO: make dependent on data density (define beforehand, change when needed)
		.attr("cy", function(d) {return Math.round(scale(data[index]));})
		.attr("cx", function(d) {
			// approximate distribution of cells over x axis
			// TODO: refine placement on requestAnimationFrame
			var y = Math.round(scale(data[index]));
			// get all cells that are already placed around the same y value
			var same = svg.selectAll("circle").filter(function(d) {
					if (!d3.select(this).attr("value")) return false;
					return Math.abs(Math.round(scale(d3.select(this).attr("value"))-y))<radius*2+1;
				});
			var side = (same[0].length%2)*2-1;
			return (columnWidth-50)/2 + (radius*2+1) * Math.ceil(same.size()/2) * side; // TODO: except if too wide! What then? make smaller circles bzw. less alpha
		})
		.attr("class", "cell")
		.attr("value", data[index])
		.attr("cellid", row)
		.attr("column", index)
		// on hover show tooltip and highlight all cells of this row
		// TODO: don't do this in css, because no color management in css.
		.on("mouseover", function(d) {
			// show tooltip
			var tooltipPositionMatrix = this.getScreenCTM().translate(+ this.getAttribute("cx"), + this.getAttribute("cy"));
			var tooltiptext = row+", "+data[index];
			if (dataStructure[index].unit) tooltiptext += " "+dataStructure[index].unit;
			d3.select(".tooltip").style("display","block")
				.style("top",(window.pageYOffset + tooltipPositionMatrix.f)+"px")
				.style("left",(window.pageXOffset + tooltipPositionMatrix.e)+"px")
				.text(tooltiptext);
			// highlight all cells of this row
			d3.selectAll(".cell[cellid='"+row+"']").attr("class", "cell hover").attr("r",5);
		})
		.on("mouseout", function(d) {
			// hide tooltip
			d3.select(".tooltip").style("display","none");
			// remove hover class and restore original radius
			d3.selectAll(".cell[cellid='"+row+"']").attr("class", "cell").attr("r", function(d){
				return d3.select("svg[index='"+d3.select(this).attr("column")+"']").attr("radius");
			});		
		});
}

function drawColumn(select) {
	// TODO: make g for data points with offset for axis and later controls and labels
	// TODO: output column names and, if set, unit
	// TODO: split into functions
	var index = select.value;
	select.value = "none"; // reset select
	var radius = 3; // starting radius
	if (d3.select(".column[index='"+index+"']").size()>0) return; // return if column already drawn
	// create svg
	var svg = d3.select("body").append("svg").attr("width",columnWidth).attr("height",columnHeight)
		.attr("class","column")
		.attr("index", index)
		.attr("radius", radius);/*
	// TODO: make first scale only with first point, draw axis if scale changed
	var scale = getScale(index); // TODO: initial scale, change if needed*/
	// draw data
	// TODO: call append on requestAnimationFrame for large data
	// TODO: implement arrays - drawing more than one circle per dataset
	var chartArea = svg.append("g").attr("class","chart").attr("transform","translate(50, 0)")
	//chartArea.selectAll("cell").data(data).enter().each(drawCell);
	var dataIndex = 0;
	// set a new timer
	// draw a new point every 10 ms
	// TODO: requestAnimationFrame
	var timer = setInterval(function() {
		if (data[dataIndex][index] !== undefined && data[dataIndex][index] !== null) { // don't draw if value is null or undefined
			drawCell(data[dataIndex], svg)
		}
		dataIndex++;
		if (dataIndex >= data.length) {window.clearInterval(timer);} // selfdestruct on end of data
	}, 10);
}

function drawAxis(structure, svg) {
	// remove if already drawn
	svg.select(".axis").remove();
	// generate axis
	var axis = d3.svg.axis()
	    .scale(structure.scale) // TODO: if enum, this will be different
	    .orient("left")
	    .ticks(20); // TODO: if enum, this will be different
	// TODO: draw boundaries if applicable
	svg.append("g").attr("transform", "translate(40,0)").attr("class","axis").call(axis); // TODO: what if labels are wider than 40px? big numbers?
}

function checkScale(structure, data, svg) {
	if (!structure.scale) { // if no scale is set, create a new one and draw its axis
		switch(structure.type) {
			case "enum": break; // TODO
			case "int":
			case "float":
			default: structure.min = data;
				structure.max = data; 
				structure.scale = d3.scale.linear().domain([data-1, data+1]).range([columnHeight,0]);
				drawAxis(structure, svg);
		}
		return;
	}
	// check if scale is still correct
	switch(structure.type) {
		case "enum": break; // TODO
		case "int":
		case "float":
		default: if (data>structure.min && data<structure.max) return; // no change in scale
			if (data <= structure.min) { // set a new minimum at 5% of domain below actual minimum
				// if minimum value is close to zero, start the scale at zero
				structure.min = (data>0 && data<(structure.max-data) * 0.15)?0:data-(structure.max-data)*0.05; 
			}
			if (data >= structure.max) { // set a new maximum at 5% of domain above actual maximum
				structure.max = data+(data-structure.min)*0.05;
			}
			structure.scale.domain([structure.min, structure.max]);
			drawAxis(structure, svg); // redraw axis
			// TODO: all cells up to this point need to be repositioned (with transitions)
	}	
}

// TODO: dynamic number of datasets
// TODO: dynamically responding to window size
// TODO: optional adding group boundaries to floats and ints, or gradients, or colors
// TODO: dynamic output of grouped data for chart drawing (probably) (later)

init();
