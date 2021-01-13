let ServerRegion = 'MaoXiaoPang';
let ManualMode = false;

//const COS_ENDPOINT = 'https://ff-1251188240.cos.accelerate.myqcloud.com/data_mining/leve';
const COS_ENDPOINT = 'https://localhost:2021';
const PRICE_AMOUNT = 10;

// utils
const open_url = function (url) {
  window.open(url, '_blank');
};

const fetchUniversalis = function (server_region, item_id) {
  return fetch(`https://universalis.app/api/${server_region}/${item_id}`).then((response) => response.json());
};

const get_listings = function (listings, hq) {
  if (listings === undefined || listings.length === 0) return [];
  let l = [];
  for (const listing of listings) l = [...l, ...(listing.hq === hq ? [listing] : [])];
  return l;
};

const calculate_listings_avg = function (listings, amount) {
  listings.sort((la, lb) => la.pricePerUnit - lb.pricePerUnit);
  const filtered_listings = listings.slice(0, amount);
  const sum_price = filtered_listings.reduce((prev, curr) => { return { 'pricePerUnit': prev.pricePerUnit * prev.quantity + curr.pricePerUnit * curr.quantity, 'quantity': 1, }; }).pricePerUnit;
  const sum_quantity = filtered_listings.reduce((prev, curr) => { return { 'quantity': prev.quantity + curr.quantity, }; }).quantity;
  return Math.round(sum_price / sum_quantity);
};

const get_price = function (item, listings, amount, hq) {
  const filtered_listings = get_listings(listings, hq);
  if (filtered_listings.length === 0) {
    console.log(`no listings found for ${item.name} (${hq ? 'hq' : 'nq'})`);
    return 0;
  }
  if (filtered_listings.length < amount) {
    console.log(`not enough listings for ${item.name} (need: ${amount}, have: ${filtered_listings.length})`)
    return calculate_listings_avg(filtered_listings, filtered_listings.length);
  }
  return calculate_listings_avg(filtered_listings, amount);
}

const fetchItemPriceHQ = async function (item) {
  let json = await fetchUniversalis(ServerRegion, item.id);
  // stones are only NQ
  if (item.id <= 19) return get_price(item, json.listings, PRICE_AMOUNT, false);
  const hq_listings = get_listings(json.listings, true);
  // no hq
  if (hq_listings.length === 0) {
    console.log(`item ${item.name} is using NQ price`);
    return get_price(item, json.listings, PRICE_AMOUNT, false);
  }
  return get_price(item, json.listings, PRICE_AMOUNT, true);
}

const fetchItemPriceNQ = async function (item) {
  let json = await fetchUniversalis(ServerRegion, item.id);
  // stones are only NQ
  if (item.id <= 19) return get_price(item, json.listings, PRICE_AMOUNT, false);
  const nq_listings = get_listings(json.listings, false);
  // no hq
  if (nq_listings.length === 0) {
    console.log(`item ${item.name} doesn't have enough NQ listings`);
    return json.averagePriceNQ;
  }
  return get_price(item, json.listings, PRICE_AMOUNT, false);
}

const fetchLeveJson = function (leve_id) {
  return fetch(`${COS_ENDPOINT}/localized/${leve_id}.json`).then((response) => response.json());
};

const fetchJobJson = function (job_id) {
  return fetch(`${COS_ENDPOINT}/jobs/job_${job_id}.json`).then((response) => response.json());
};

// ui stuff
const createRowHeader = function (text) {
  const strong = document.createElement('strong');
  strong.textContent = text;

  const li = document.createElement('li');
  li.className = 'list-group-item d-flex justify-content-between';
  li.appendChild(strong);

  return li;
};

const createSingleRowItem = function (item_id, span_text, strong_text) {
  const span = document.createElement('span');
  span.setAttribute('data-ck-item-id', item_id);
  span.setAttribute('onclick', `open_url('https://universalis.app/market/${item_id}')`);
  span.textContent = span_text;

  const strong = document.createElement('strong');
  strong.textContent = strong_text;

  const li = document.createElement('li');
  li.className = 'list-group-item d-flex justify-content-between';
  li.appendChild(span);
  li.appendChild(strong);

  return li;
};

const createDoubleRowItem = function (item_id, h6_text, small_text, strong_text, offset) {
  const h6 = document.createElement('h6');
  h6.setAttribute('data-ck-item-id', item_id);
  h6.setAttribute('onclick', `open_url('https://universalis.app/market/${item_id}')`);
  h6.className = 'my-0';
  h6.textContent = h6_text;

  const small = document.createElement('small');
  small.setAttribute('class', 'text-muted');
  small.textContent = small_text;

  const div = document.createElement('div');
  div.appendChild(h6);
  div.appendChild(small);

  const strong = document.createElement('strong');
  strong.textContent = strong_text;

  const li = document.createElement('li');
  li.className = 'list-group-item d-flex justify-content-between';
  if (offset) li.className += ` ms-${offset}`;
  li.appendChild(div);
  li.appendChild(strong);

  return li;
};

const createDoubleRowItemX = function (reward_item, repeat, profit) {
  const span = document.createElement('h6');
  span.setAttribute('data-ck-item-id', reward_item.id);
  span.setAttribute('onclick', `open_url('https://universalis.app/market/${reward_item.id}')`);
  span.textContent = reward_item.name + '*' + reward_item.amount * repeat;
  const small = document.createElement('small');
  small.setAttribute('class', 'text-muted');
  small.textContent = reward_item.rate * 100 + '%';
  const div = document.createElement('div');
  div.appendChild(span);
  div.appendChild(small);

  const strong = document.createElement('strong');
  strong.textContent = profit;

  const li = document.createElement('li');
  li.className = 'list-group-item d-flex justify-content-between';
  li.appendChild(div);
  li.appendChild(strong);

  return li;
};

const clear_ui = function () {
  $('.progress-bar').width('0%')
  $('.progress-bar').addClass('progress-bar-striped');
  $('.progress-bar').addClass('progress-bar-animated');
  $('#leve-require').empty();
  $('#requirements-purchasing-cost').empty();
  $('#requirements-purchasing-cost').append(createRowHeader('收购成本'));
  $('#requirements-crafting-cost').empty();
  $('#requirements-crafting-cost').append(createRowHeader('制作成本'));
  $('#rewards').empty();
  $('#rewards-expectation').text('');
};

/**
 * 
 * @param {*} item 
 * add a `ppu` field to item with price per unit and return the total price
 * @return ppu*amount
 */
const calculate_purchase = async function (item, hq) {
  item.ppu = hq ? await fetchItemPriceHQ(item) : await fetchItemPriceNQ(item);
  console.log(`purchase price for ${item.name}(${hq ? 'hq' : 'nq'}) is ${item.ppu}. need ${item.amount}`);
  return item.ppu * item.amount;
};

const update_purchase = function (require, repeat, active) {
  const total_amount = require.amount * repeat;
  const total_cost = require.ppu * total_amount;
  $('#requirements-purchasing-cost').append(createDoubleRowItem(require.id, `${require.name}*${total_amount}`, `单价 ${require.ppu}`, total_cost));
  $('#requirements-purchasing-cost > li:first-child').append(`<strong>${total_cost}</strong>`);
  if (active) $('#requirements-purchasing-cost > li:first-child').addClass('list-group-item-success');
}

/**
 * Note: we always craft with nq, which is not accurate in some scenario
 * @param {*} craft craft recipe
 * @param {array} ic array of ingredients craft recipes
 * @return craft ingredients and total cost
 */
const calculate_craft = async function (craft, ic, hq) {
  let calc = {
    ingredients: [],
    ppu: 0,
  };

  for (let ingredient of craft.ingredients) {
    ingredient.amount /= craft.yield;
    const price = await calculate_purchase(ingredient, hq);

    // craft it!
    if (('' + ingredient.id) in ic) {
      // note: this is craft calc for 1 peice
      let craft_calc = await calculate_crafts(ic['' + ingredient.id], ic, false);
      console.log(`ingredient ${ingredient.name} craft price per unit is ${craft_calc.ppu}`);

      if (craft_calc.ppu < ingredient.ppu) {
        console.log(`ingredient ${ingredient.name} is using craft`);

        // add craft cost
        ingredient.craft_ppu = Math.round(craft_calc.ppu);
        // add craft
        ingredient.craft = craft_calc.ingredients;
        // add to calc
        calc.ingredients = [...calc.ingredients, ingredient];
        calc.ppu += ingredient.craft_ppu * ingredient.amount;

        continue;
      }
    }

    calc.ingredients = [...calc.ingredients, ingredient];
    calc.ppu += price;
  }

  return calc;
};

/**
 * 
 * @param {array} crafts array of craft recipes
 * @param {array} ic array of ingredients craft recipes
 * @return recipe with lowest cost of among all recipes for each
 */
const calculate_crafts = async function (crafts, ic, hq) {
  let better = {
    ingredients: [],
    ppu: Number.MAX_VALUE,
  }

  for (const craft of crafts) {
    const craft_calc = await calculate_craft(craft, ic, hq);
    if (craft_calc.ppu < better.ppu) better = craft_calc;
  }

  return better;
}

const update_ingredients = function (ingredients, amount, repeat, level) {
  for (const ingredient of ingredients) {
    const total_amount = ingredient.amount * amount * repeat;

    if ('craft' in ingredient) {
      const total_craft_cost = ingredient.craft_ppu * total_amount;

      $('#requirements-crafting-cost')
        .append(createDoubleRowItem(ingredient.id, `${ingredient.name}*${total_amount}`,
          `购买单价 ${ingredient.ppu}, 制作单价 ${ingredient.craft_ppu}`, `制作 ${total_craft_cost}`, level));

      update_ingredients(ingredient.craft, amount * ingredient.amount, repeat, level + 1);
      continue;
    }

    const total_purchase_cost = ingredient.ppu * total_amount;
    $('#requirements-crafting-cost').append(createDoubleRowItem(ingredient.id, `${ingredient.name}*${total_amount}`, `单价 ${ingredient.ppu}`, total_purchase_cost, level));
  }
};

/**
 * 
 * @param {*} craft_calc craft recipe
 * @param {*} amount amount needed to craft
 * @param {*} repeat 
 * @param {*} active 
 */
const update_craft = function (craft_calc, amount, repeat, active) {
  update_ingredients(craft_calc.ingredients, amount, repeat, 0);

  $('#requirements-crafting-cost > li:first-child').append(`<strong>${Math.round(craft_calc.ppu * amount * repeat)}</strong>`);
  if (active) $('#requirements-crafting-cost > li:first-child').addClass('list-group-item-success');
};

const updateCost = async function (data, repeat, hq) {
  const amount = data.require.amount;

  const purchase_cost = await calculate_purchase(data.require, true);
  // note craft cost is per item
  const craft_calc = await calculate_crafts(data.craft, data.ic, hq);

  update_purchase(data.require, repeat, purchase_cost < craft_calc.ppu * amount);
  update_craft(craft_calc, amount, repeat, purchase_cost > craft_calc.ppu * amount);

  return {
    purchase: purchase_cost * repeat,
    craft: craft_calc.ppu * amount * repeat,
  }
};

/**
 * build
 */
const updateCostManual = function () {
  return {
    purchase: 0,
    craft: 0,
  }
};

const updateReward = async function (cost, reward, repeat, leve_cost) {
  const better_cost = cost.purchase < cost.craft ? cost.purchase : cost.craft;
  // assuming HQ for now. HQ gets doubled gold reward
  const gil = reward.gil * repeat * 2;
  // repeated net profit
  const net = gil - better_cost;

  console.log(`leve (x${repeat}) gil=${gil} cost=${better_cost} net=${net}`);

  // profit with math expectation
  let profit_exp = net / repeat;

  for (let item of reward.items) {
    const price = await calculate_purchase(item);
    const profit = (net + price * repeat) / leve_cost;
    $('#rewards').append(createDoubleRowItem(item.id, `${item.name}*${item.amount * repeat}`, `单价 ${item.ppu}, 概率 ${item.rate * 100}%`, profit));
    profit_exp += price * item.rate;
  }

  return profit_exp * repeat / leve_cost;
};

const processLeve = async function (data) {
  // empty all previous progress
  clear_ui();
  $('.progress-bar').width('20%');

  // all rewards are calculated based on the repeated times
  const repeat = data.leve.repeat + 1;
  // and leve cost
  const leve_cost = data.leve.is_large ? 10 : 1;

  let cost = {
    purchase: 0,
    craft: 0,
  };

  if (ManualMode) {

  } else {
    cost = await updateCost(data, repeat);
    $('.progress-bar').width('60%')
  }

  let profit_exp = await updateReward(cost, data.reward, repeat, leve_cost);
  $('#rewards-expectation').text(Math.round(profit_exp));

  $('.progress-bar').width('100%')
  $('.progress-bar').removeClass('progress-bar-striped');
  $('.progress-bar').removeClass('progress-bar-animated');
};

const initSelect = async function (job_id) {
  $('#select-spinner').removeClass('d-none');
  if ($('.guildleve-select').hasClass("select2-hidden-accessible")) {
    $('.guildleve-select').select2('destroy');
    $('.guildleve-select').off('select2:select');
    $('.guildleve-select').html('');
  }
  const resp = await fetchJobJson(job_id);
  const selectConfig = {
    data: [{ id: 0, text: '选择一个委托' }, ...resp],
    width: 'style',
    theme: 'bootstrap4',
  };
  $('.guildleve-select').select2(selectConfig);
  $('#select-spinner').addClass('d-none');
  $('.guildleve-select').on('select2:select', function (e) {
    var data = e.params.data;
    if (data.id !== 0) fetchLeveJson(data.id).then((resp) => processLeve(resp));
  });
};

const initListeners = function () {
  $('#job_select').on('click', '*', function () {
    clear_ui();
    const job_id = $(this).attr('data-job-id');
    initSelect(job_id);
    $('#job_select > a').removeClass('active');
    $(this).addClass('active');
  });
  $('#server-region').on('change', function (data) {
    const val = data.currentTarget.selectedOptions[0].value;
    ServerRegion = val;
    console.log(`change server region to ${ServerRegion}`);
  });
  $('#btn-manual').on('change', function () {
    ManualMode = this.checked;
    console.log(`change manual mode to ${ManualMode}`);
  });
};

$(function () {
  CafeKitTooltip.initTooltip();
  initListeners();
  clear_ui();
});