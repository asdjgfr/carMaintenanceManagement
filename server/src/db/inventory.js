const { inventory } = require("./dataBase");
const fs = require("fs");
const path = require("path");
const { multiply } = require("../plugins/math");

exports.saveInventory = async function (params) {
  let {
    supplier,
    type,
    code,
    name,
    count,
    costPrice,
    sellingPrice,
    guidePrice,
    unit,
    minCount,
    deliveryTime,
    deviceID,
    session,
    id,
  } = params;
  id = id || "";
  const defaults = {
    supplier,
    type,
    code,
    name,
    count,
    purchaseCount: count,
    costPrice,
    totalCostPrice: costPrice * count,
    sellingPrice,
    lastPurchasePrice: costPrice,
    unit,
    minCount,
    storageTime: new Date(),
    deviceID,
    session,
  };
  if (deliveryTime) {
    defaults.deliveryTime = deliveryTime;
  }

  if (guidePrice !== undefined) {
    defaults.guidePrice = guidePrice;
  }

  const [data, created] = await inventory.findOrCreate({
    where: { id },
    defaults,
  });

  if (!created) {
    // 不是创建则删除进货量
    delete defaults.purchaseCount;
    defaults.lastPurchasePrice = data.lastPurchasePrice;
    Object.keys(defaults).forEach((key) => {
      data[key] = defaults[key];
    });
    await data.save();
  }
  // 更新最新进价
  const sameInventory = await inventory.findAll({
    where: { code, name },
  });
  for (let i = 0, len = sameInventory.length; i < len; i++) {
    sameInventory[i].lastPurchasePrice = defaults.costPrice;
    await sameInventory[i].save();
  }
  return {
    code: 0,
    msg: created ? "保存成功！" : "更新成功！",
    data: data.id,
  };
};
exports.saveInventoryBulk = async function (params) {
  const { session, deviceID } = params;
  const data = JSON.parse(params.data);
  const keys = {
    name: { label: "配件名称", default: () => `配件${new Date().getTime()}` },
    code: { label: "配件代码", default: () => `配件${new Date().getTime()}` },
    supplier: { label: "供货商", default: "未知" },
    type: { label: "配件种类", default: "未知" },
    count: { label: "库存量", default: 0 },
    purchaseCount: { label: "库存量", default: 0 },
    costPrice: { label: "成本价", default: 0 },
    guidePrice: { label: "销售指导价", default: 0 },
    sellingPrice: { label: "销售价", default: 0 },
    lastPurchasePrice: { label: "成本价", default: 0 },
    unit: { label: "单位", default: "无单位" },
    minCount: { label: "最小包装数", default: 1 },
  };
  const bulk = await inventory.bulkCreate(
    data.map((item) => {
      const res = { deviceID, session, storageTime: new Date() };
      Object.keys(keys).forEach((key) => {
        res[key] =
          item[keys[key].label] ??
          (typeof keys[key].default === "function"
            ? keys[key].default()
            : keys[key].default);
      });
      res.totalCostPrice = multiply(res.costPrice, res.count);
      return res;
    })
  );
  return {
    code: 0,
    msg: `成功导入${bulk.length}条！`,
  };
};
exports.queryInventory = async function (params) {
  const tmp = {
    id: "",
    supplier: "",
    name: "",
    type: "",
    code: "",
    createdAtInterval: [],
    updatedAtInterval: [],
    counts: [0, 0],
    limit: "",
    offset: "",
  };
  const where = {};
  const keys = Object.keys(tmp);
  const onlyID = !!params.id;
  for (let i = 0, len = keys.length; i < len; i++) {
    const key = keys[i];
    if (key === "limit" || key === "offset") {
      continue;
    }
    if (key === "createdAtInterval") {
      if (Array.isArray(params[key]) && params[key].length === 2) {
        where["storageTime"] = {
          $gte: new Date(params[key][0]),
          $lte: new Date(params[key][1]),
        };
      }
    } else if (key === "updatedAtInterval") {
      if (Array.isArray(params[key]) && params[key].length === 2) {
        where["deliveryTime"] = {
          $gte: new Date(params[key][0]),
          $lte: new Date(params[key][1]),
        };
      }
    } else if (key === "counts") {
      if (Number(params[key][0]) !== 0 && Number(params[key][1]) !== 0) {
        where["count"] = {
          $gte: Number(params[key][0]),
          $lte: Number(params[key][1]),
        };
      }
    } else if (!["", undefined, null].some((t) => t === params[key])) {
      if (key === "id") {
        where[key] = params[key];
      } else {
        where[key] = {
          $like: `%${params[key]}%`,
        };
      }
    }
  }

  let data = null;
  const options = {
    where,
  };
  if (params.limit !== undefined) {
    options.limit = Number(params.limit);
  }
  if (params.offset !== undefined) {
    options.offset = Number(params.offset);
  }
  if (onlyID) {
    data = await inventory.findOne(options);
  } else {
    data = await inventory.findAndCountAll(options);
  }

  if (data === null || (data.rows !== undefined && data.rows.length === 0)) {
    return { code: 205, msg: "未找到库存！" };
  }

  return {
    code: 0,
    msg: "查找成功！",
    data: Array.isArray(data.rows)
      ? data.rows.map((d) => ({
          ...JSON.parse(JSON.stringify(d)),
        }))
      : {
          ...JSON.parse(JSON.stringify(data)),
        },
    length: data.count || 0,
  };
};

exports.delInventory = async function (id) {
  // 根据ID删除库存
  await inventory.destroy({
    where: {
      id,
    },
  });
  return { code: 0, msg: "删除库存成功！" };
};

exports.queryInventoryAttrs = async function (attr, q, query, notIn) {
  let data = null;
  if (query !== undefined) {
    // 查询项目
    const where = {};
    where[attr] = {
      $like: `%${query}%`,
      $notIn: notIn,
    };
    data = await inventory.findAll({
      where,
    });
    data = data.reduce((acc, cur) => {
      let index = acc.findIndex(
        (item) => item.code === cur.code && item.name === cur.name
      );
      if (index > -1) {
        acc[index] = Object.assign(acc[index], {
          count: acc[index].count + cur.count,
          supplier: acc[index].supplier + `，${cur.supplier}`,
          costPrice: acc[index].costPrice + `，${cur.costPrice}`,
          id: "",
        });
      } else {
        acc.push(Object.assign(cur, { id: "" }));
      }
      return acc;
    }, []);
  } else {
    // 查询类型
    let filter = await inventory.findAll({
      attributes: [attr],
    });
    data = new Set();
    filter.forEach((d) => {
      if (d[attr].match(q)) {
        data["add"](d[attr]);
      }
    });
  }
  return { code: 0, msg: "查询成功！", data: [...data] };
};

exports.downloadITemplate = async function () {
  return fs.readFileSync(
    path.resolve(__static, "templates", "配件导入模板.xlsx")
  );
};
