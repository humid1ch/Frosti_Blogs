---
title: "[C++项目] Boost文档 站内搜索引擎(4): 搜索的相关接口的实现、线程安全的单例index接口、cppjieba分词库的使用、综合调试..."
pubDate: "2023-08-05"
description: "本篇文章的内容为: 查找、搜索 相关接口的实现, 建立索引接口的相关优化, 本地搜索测试. 做完上面的内容, 就后面就是加入网络和页面的制作了~"
image: https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/202308050919612.webp
categories: ['tech']
tags: ["项目", "搜索引擎", "Boost库"]
---

有关`Boost`文档搜索引擎的项目的前三篇文章, 已经分别介绍分析了:

1. 项目背景: [🫦[C++项目] Boost文档 站内搜索引擎(1): 项目背景介绍、相关技术栈、相关概念介绍...](https://www.humid1ch.cn/posts/Boost-Doc-Searcher-I)
2. 文档解析、处理模块`parser`的实现: [🫦[C++项目] Boost文档 站内搜索引擎(2): 文档文本解析模块parser的实现、如何对文档文件去标签、如何获取文档标题...](https://www.humid1ch.cn/posts/Boost-Doc-Searcher-II)
3. 文档**正排索引与倒排索引**建立的接口的实现: [🫦[C++项目] Boost文档 站内搜索引擎(3): 建立文档及其关键字的正排 倒排索引、jieba库的安装与使用...](https://www.humid1ch.cn/posts/Boost-Doc-Searcher-III)
4. **`建议先阅读上面三篇文章`**

已经实现了对文档建立索引的相关接口. 有了接口, 就可以调用并建立文档索引.

建立了索引, 其实就可以根据索引查找文档了. 所以, 本篇文章的内容即为: 

1. 查找、搜索 相关接口的实现
2. 建立索引接口的相关优化
3. 本地搜索测试

做完上面的内容, 就后面就是加入网络和页面的制作了~

# 搜索

搜索是通过输入的内容进行搜索的. 并且一定是**先在倒排索引中找到文档`id`, 再根据文档`id`去正排索引中找到文档**的内容.

而倒排索引中存储的内容是对文档内容进行分词, 然后根据分词建立的.

那么要实现搜索, 也需要**对搜索的内容进行分词, 然后再根据搜索内容的分词 在 倒排索引中查找关键词对应的倒排拉链**

## 搜索接口的基本结构

了解了搜索的流程, 那么搜索的相关接口的基本结构实际也就显现出来了:

```cpp
namespace ns_searcher {
	class searcher {
	private:
		ns_index::index* _index; // 建立索引的类

	public:
        // 初始化接口
        // 在搜索之前需要先建立索引. 这个接口就是建立索引用的
		void initSearcher(const std::string& input) {}

		// 搜索接口
		// 搜索需要实现什么功能?
        // 搜索需要接收字符串, 然后针对字符串进行分词 再根据分词在索引中进行查找
		// 首先参数部分需要怎么实现?
		// 参数部分, 需要接收需要搜索的句子或关键字, 还需要一个输出型参数 用于输出查找结果
		//  查找结果我们使用jsoncpp进行序列化和反序列化
		void search(const std::string& query, std::string* jsonString) {}
```

基本的结构就这么简单. 只需要对外提供两个接口:

1. `initSearcher()` 初始化接口
2. `search()` 搜索接口

## `initSearcher()`接口 实现

`initSearcher()` 是用来做搜索前的工作的, 实际就是建立索引的接口

但是, 在建立索引之前 我们清楚 所有的搜索都是在唯一一个倒排索引和唯一一个正排索引中进行的. 也就是说**最终一个程序中只需要建立一次索引**. 所以我们可以将索引的相关函数实现为单例.

### `index`接口类 单例实现

`index`类的单例实现非常的简单:

```cpp
namespace ns_index {

	// 用于正排索引中 存储文档内容
	typedef struct docInfo {
		std::string _title;	  // 文档标题
		std::string _content; // 文档去标签之后的内容
		std::string _url;	  // 文档对应官网url
		std::size_t _docId;	  // 文档id
	} docInfo_t;

	// 用于倒排索引中 记录关键字对应的文档id和权重
	typedef struct invertedElem {
		std::size_t _docId;	   // 文档id
		std::string _keyword;  // 关键字
		std::uint64_t _weight; // 搜索此关键字, 此文档id 所占权重

		invertedElem() // 权重初始化为0
			: _weight(0) {}
	} invertedElem_t;

	// 关键字的词频
	typedef struct keywordCnt {
		std::size_t _titleCnt;	 // 关键字在标题中出现的次数
		std::size_t _contentCnt; // 关键字在内容中出现的次数

		keywordCnt()
			: _titleCnt(0)
			, _contentCnt(0) {}
	} keywordCnt_t;

	// 倒排拉链
	typedef std::vector<invertedElem_t> invertedList_t;

	class index {
	private:
		// 正排索引使用vector, 下标天然是 文档id
		std::vector<docInfo_t> forwardIndex;
		// 倒排索引 使用 哈希表, 因为倒排索引 一定是 一个keyword 对应一组 invertedElem拉链
		std::unordered_map<std::string, invertedList_t> invertedIndex;

		// 单例模式设计
		index() {}

		index(const index&) = delete;
		index& operator=(const index&) = delete;

		static index* _instance; // 单例
		static std::mutex _mtx;

	public:
		// 获取单例
		static index* getInstance() {
			if (nullptr == _instance) {
				_mtx.lock();
				if (nullptr == _instance) {
					_instance = new index;
				}
				_mtx.unlock();
			}

			return _instance;
		}
		
        // 通过关键字 检索倒排索引, 获取对应的 倒排拉链
		invertedList_t* getInvertedList(const std::string& keyword) {}

		// 通过倒排拉链中 每个倒排元素中存储的 文档id, 检索正排索引, 获取对应文档内容
		docInfo_t* getForwardIndex(std::size_t docId) {}

		// 根据parser模块处理过的 所有文档的信息
		// 提取文档信息, 建立 正排索引和倒排索引
		// input 为 ./data/output/raw
		bool buildIndex(const std::string& input) {}

	private:
		// 对一个文档建立正排索引
		docInfo_t* buildForwardIndex(const std::string& file) {}
        // 对一个文档建立倒排索引
		bool buildInvertedIndex(const docInfo_t& doc) {}
	};
	// 单例相关
	index* index::_instance = nullptr;
	std::mutex index::_mtx;
}
```

需要做的工作也就只有:

1. 添加两个成员变量, 并在类外定义: 

    **`static index* _instance;`**

    **`static std::mutex _mtx;`**

2. 构造函数设置私有, 拷贝构造函数和赋值重载函数删除:

    **`index() {}`**

    **`index(const index&) = delete;`**

    **`index& operator=(const index&) = delete;`**

3. 添加线程安全的获取单例的公开接口:

    ```cpp
    static index* getInstance() {
        if (nullptr == _instance) {
            _mtx.lock();
            if (nullptr == _instance) {
                _instance = new index;
            }
            _mtx.unlock();
        }
    
        return _instance;
    }
    ```

这样就将`index`类设计为了单例模式

### 接口实现

`initSearcher()`接口的实现也是非常的简单, 只需要建立索引就可以了:

```cpp
void initSearcher(const std::string& input) {
    // 搜索前的初始化操作
    // search类成员 ns_index::index* _index 获取单例
    _index = ns_index::index::getInstance();
    std::cout << "获取单例成功 ..." << std::endl;
    
    // 建立索引
    _index->buildIndex(input);
    std::cout << "构建正排索引、倒排索引成功 ..." << std::endl;
}
```

## `search()`接口 实现**

`searcher`类中, 初始化接口`initSearcher()`实现的简单.

但是`search()`就没有那么简单了, 需要注意非常多的细节

搜索接口需要实现的功能是: 

1. 接收字符串, 然后针对字符串进行分词
2. 再根据分词在倒排索引中查找对应的倒排拉链
3. 通过倒排拉链获取相关文档的id
4. 再根据文档id, 查找正排索引查找对应的文档内容信息
5. 最终查找到的文档内容信息是需要输出的, 所以我们接口使用了输出型参数

但这只是功能实现的整体逻辑. 还有许多的细节需要考虑:

1. 倒排索引中的 关键词都是小写的, 而搜索输入的内容很可能存在大小写, 如何实现忽略大小写的搜索呢?

2. 查找到倒排拉链之后, 是可以通过遍历拉链 获取到文档id等相关信息的

    不过, 页面的显示是需要按照相关度排序的, 我们也在倒排索引中 使用词频简单地体现出了 关键字与对应文档的相关性

    那么如何对获取到的文档进行排序呢?

3. 在查找的时候, 一定会有不同的词 查找到同一个文档的问题. 那么 如果不做处理, 就会出现同一个文档在页面中不同的位置 被显示出来的问题, 该怎么解决呢?

4. 获取到文档内容信息之后, 是需要将设置文档需要展示的相关信息的: `title` `description` `url`

    如果文档内容过长, 一定不能将文档全部内容展示在搜索页面中, 那么如何获取文章相关的摘要呢?

5. 还有一些其他细节, 结合代码具体分析...

那么, 根据需求 `search()`接口的实现代码就是这样的:

```cpp
typedef struct invertedElemOut {
    std::size_t _docId;
    std::uint64_t _weight;
    std::vector<std::string> _keywords;
} invertedElemOut_t;

// 搜索接口
// 首先参数部分需要怎么实现?
// 参数部分, 需要接收需要搜索的句子或关键字, 还需要一个输出型参数 用于输出查找结果
//  查找结果我们使用jsoncpp进行序列化和反序列化
// search() 具体需要实现的功能:
//  1. 对接收的句子或关键词进行分词
//  2. 根据分词, 在倒排索引中查找到所有分词的倒排拉链 并汇总其中的 invertedElem, 然后根据相关性进行排序
//  4. 然后再遍历所有的 invertedElem, 根据 invertedElem中存储的 文档id, 在正排索引中获取到文档内容
//  5. 然后将获取到的文档内容使用jsoncpp 进行序列化, 存储到输出型参数中
// 直到遍历完invertedElem
void search(const std::string& query, std::string* jsonString) {
    // 1. 对需要搜索的句子或关键词进行分词
    std::vector<std::string> keywords;
    ns_util::jiebaUtil::cutString(query, &keywords);

    // 统计文档用, 因为可能存在不同的分词 在倒排索引中指向同一个文档的情况
    // 如果不去重, 会重复展示
    std::unordered_map<std::size_t, invertedElemOut_t> invertedElemOutMap;
    // 2. 根据分词获取倒排索引中的倒排拉链, 并汇总去重 invertedElem
    for (std::string word : keywords) {
        boost::to_lower(word);

        ns_index::invertedList_t* tmpInvertedList = _index->getInvertedList(word);
        if (nullptr == tmpInvertedList) {
            // 没有这个关键词
            continue;
        }

        for (auto& elem : *tmpInvertedList) {
            // 遍历倒排拉链, 根据文档id 对invertedElem 去重
            auto& item = invertedElemOutMap[elem._docId]; // 在map中获取 或 创建对应文档id的 invertedElem
            item._docId = elem._docId;
            item._weight += elem._weight;
            // 权重需要+= 是因为多个关键词指向了同一个文档 那么就说明此文档的与搜索内容的相关性更高
      		// 就可以将多个关键字关于此文档的权重相加, 表示搜索相关性高
            // 最好也将 此文档相关的关键词 也存储起来, 因为在客户端搜索结果中, 可能需要对网页中有的关键字进行高亮
            // 但是 invertedElem 的第三个成员是 单独的一个string对象, 不太合适
            // 所以, 可以定义一个与invertedElem 相似的, 但是第三个成员是一个 vector 的类, 比如 invertedElemOut
            item._keywords.push_back(elem._keyword);
            // 此时就将当前invertedElem 去重到了 invertedElemMap 中
        }
    }
    
    // vector 存储 文档id相关信息, 方便排序
    std::vector<invertedElemOut_t> allInvertedElemOut;
    // 出循环之后, 就将搜索到的 文档的 id、权重和相关关键词 存储到了 invertedElemMap
    // 然后将文档的相关信息 invertedElemOut 都存储到 vector 中
    for (const auto& elemOut : invertedElemOutMap) {
        // map中的second: elemOut, 在执行此操作之后, 就没用了
        // 所以使用移动语义, 防止发生拷贝
        allInvertedElemOut.push_back(std::move(elemOut.second));
    }

    // 执行到这里, 可以搜索到的文档id 权重 和 相关关键词的信息, 已经都在allInvertedElemOut 中了.
    // 但是, 还不能直接 根据文档id 在正排索引中检索
    // 因为, 此时如果直接进行文档内容的索引, 在找到文档内容之后, 就要直接进行序列化并输出了. 而客户端显示的时候, 反序列化出来的文档顺序, 就是显示的文档顺序
    // 但是现在找到的文档还是乱序的. 还需要将allInvertedElemOut中的相关文档, 通过_weight 进行倒序排列
    // 这样, 序列化就是按照倒序排列的, 反序列化也会如此, 显示同样如此
    std::sort(allInvertedElemOut.begin(), allInvertedElemOut.end(),
              [](const invertedElemOut_t& elem1, const invertedElemOut_t& elem2) {
                  return elem1._weight > elem2._weight;
              });

    // 排序之后, allInvertedElemOut中 文档的排序就是降序了
    // 然后 通过遍历此数组, 获取文档id, 根据id获取文档在正排索引中的内容
    // 然后再将 所有内容序列化
    Json::Value root;
    for (auto& elemOut : allInvertedElemOut) {
        // 通过Json::Value 对象, 存储文档内容
        Json::Value elem;
        // 通过elemOut._docId 获取正排索引中 文档的内容信息
        ns_index::docInfo_t* doc = _index->getForwardIndex(elemOut._docId);
        // elem赋值
        elem["url"] = doc->_url;
        elem["title"] = doc->_title;
        // 关于文档的内容, 搜索结果中是不展示文档的全部内容的, 应该只显示包含关键词的摘要, 点进文档才显示相关内容
        // 而docInfo中存储的是文档去除标签之后的所有内容, 所以不能直接将 doc._content 存储到elem对应key:value中
        elem["desc"] = getDesc(doc->_content, elemOut._keywords[0]); // 只根据第一个关键词来获取摘要
        // for Debug
        // 这里有一个bug, jsoncpp 0.10.5.2 是不支持long或long long 相关类型的, 所以需要转换成 double
        // 这里转换成 double不会有什么影响, 因为这两个参数只是本地调试显示用的.
        elem["docId"] = (double)doc->_docId;
        elem["weight"] = (double)elemOut._weight;

        root.append(elem);
    }

    // 序列化完成之后将相关内容写入字符串
    // for Debug 用 styledWriter
    Json::StyledWriter writer;
    *jsonString = writer.write(root);
}
```

执行搜索, 首先要做的就是**对传入的字符串进行分词**

然后根据每个分词, 在倒排索引中查找对应的倒排拉链, 再通过遍历倒排拉链就可以获取到当前关键字对应出现的文档相关信息.

不过, 分词之后-遍历时-正式查找之前 要做的首要任务就是,**将分词转换为小写**. 因为, 倒排索引中的所有关键词 都是小写的状态

并且, 查找到倒排拉链 在获取并统计文档信息时, 还会出现不同关键字指向同一文档的情况, 这种情况是需要处理的**不能多次记录同一个文档**.

还有就是, 如果一次搜索中**多个关键词指向了同一个文档 那么就说明此文档的与搜索内容的相关性更高**, 此时是需要将文档的显示权重增加的.

根据这些需求, 实现了第一部分的代码:

![](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/202308052319950.webp)

第一部分的代码实现了:

1. 对搜索内容分词
2. 遍历分词查找倒排拉链
3. 根据倒排拉链 去重获取文档信息

这部分代码, 有三个要点:

1. 需要定义一个`unordered_map`来实现对搜索到的文档 记录并去重

2. 如果单纯地 对多个关键词搜到的同一个文档 去重, 而不记录相关的关键字, 那么就无法得知此文档是根据那些关键字搜索到的.  那么再去重的同时, 还需要记录对应的关键词

    也就是说, `unordered_map` 存储的元素类型不能是简单的`ns_index::invertedElem`, 因为`invertedElem`没有办法很好的记录多个关键词

    所以, 定义了一个结构体:

    ```cpp
    typedef struct invertedElemOut {
        std::size_t _docId;
        std::uint64_t _weight;
        std::vector<std::string> _keywords;
    } invertedElemOut_t;
    ```

    成员依旧包括 文档`id`和权重, 但是第三个成员变量与`invertedElem`不同, `invertedElemOut`的第三个成员变量是`vector<string>`, 适合存储多个关键字.

3. 第三个要点就是: `unordered_map`中存储的对应此关键字的元素的权重, 需要`+=`当前关键字的权重.

    因为**多个关键词指向了同一个文档 那么就说明此文档的与搜索内容的相关性更高, 所以 就可以将多个关键字关于此文档的权重相加, 表示搜索相关性高**

第一部分执行完之后, 根据搜索内容 查找到的所有的文档的相关信息, 都存储在了`invertedElemOutMap`中.

接下来要做的, 并不是遍历`unordered_map`获取文档`id`, 去正排索引中查找文档的内容. 而是需要先根据文档的显示权重进行排序. 排完序之后, 再进行文档内容的获取.

因为, 获取每到一个文档内容就需要将文档内容输出了, 输出之后 就要做处理响应回客户端进行显示了. 这也意味着 在正排索引中的查找顺序 实际就是搜索结果的显示顺序, 所以在查找之前, 需要先排序:

![](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/202308060002659.webp)

这里的实现, 先使用`vector`存储`invertedElemOut`元素. 为了方便排序

然后通过`std::sort()`+`lambda`进行降序排序

这里需要注意一个细节:

1. 在向`vector`插入元素时, 对`invertedElemOutMap`中存储的元素执行`std::move()`

    也就是 使用移动语义, 防止发生拷贝构造. 

    可以使用移动语义的原因就是, 构建完`vector`之后, `invertedElemOutMap`就没用了, 不需要存储元素.

执行完这一部分代码. 此次搜索到的所有的文档id相关信息就按照显示权重的降序被存储到了 `std::vector<invertedElemOut_t> allInvertedElemOut`中.

接下来, 就是根据文档id相关信息 在正排索引中 查找文档内容信息了

这部分代码, 实际就是搜索的最后一部分代码了. 

最后一部分的代码 其实相对简单, 只需要在正派索引中找到文档的内容信息, 然后序列化并存储起来就可以了.

等获取到全部的文档内容信息, 再将结果通过输出型参数传递出去就可以了

> 对内容做序列化处理, 需要用到`jsoncpp`.
>
> 在`CentOS`平台下, 直接执行`sudo yum install -y jsoncpp-devel`就可以安装了
>
> 关于`jsoncpp`最基本的使用的相关介绍, 可以看一下这篇文章:
>
> [[Linux] 初识应用层协议: 序列化与反序列化、编码与解码、jsoncpp简单食用...](https://www.humid1ch.cn/posts/Linux-Application-Layer-Protocol)

![](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/202308061850368.webp)

这段代码中, 唯一要注意的就是: 

使用`Json::Value root`存储`Json::Value elem`的方式, 在`root`存储不同文档的序列化内容. 

在之前的使用中, 只需要通过`Json::Value`变量序列化一个结构体之后, 就可以将`Json::Value`的结果写入`string`了.

而, 这里为什么要套两层`Json::Value`呢?

因为, 这里 传输的不只是一个结构体变量的内容, 而是**有很多个结构体**. 很多个同类型结构体的内容都需要序列化并存储起来, 很自然而然就可以想到要使用两层结构. 并且还需要保证序列化, 所以就是用`Json::Value`嵌套的方式对不同的文档内容序列化并存储.

而 `Json::Value`也很好的支持了存储`Json::Value`的接口, 就是`Json::Value::append()`. 

>  源码中关于`append()`的声明, 参数就是`Json::Value&`:
>
> ```cpp
> Value& Value::append(const Value& value) { return append(Value(value)); }
> 
> Value& Value::append(Value&& value) {
>       JSON_ASSERT_MESSAGE(type() == nullValue || type() == arrayValue,
>                            "in Json::Value::append: requires arrayValue");
>       if (type() == nullValue) {
>            *this = Value(arrayValue);
>       }
>       return this->value_.map_->emplace(size(), std::move(value)).first->second;
> }
> ```

还有就是, `elem`中并不 序列化存储文档的完整内容, 而是存储文档的部分内容.

所以就需要实现一个`getDesc()`接口

### `getDesc()`摘要获取接口 实现

我们摘要获取的思路非常简单, 就是 在正文内容中找到第一个关键词的所在位置. 然后 截取 此位置的前50字节到此位置的后100字节 的内容.

```cpp
std::string getDesc(const std::string& content, const std::string& keyword) {
    // 如何获取摘要呢?
    // 我们尝试获取正文中 第一个keyword 的前50个字节和后100个字节的内容 作为摘要
    const std::size_t prevStep = 50;
    const std::size_t nextStep = 100;

    // 获取正文中 第一个 keyword 的位置
    std::size_t pos = content.find(keyword);
    if (pos == std::string::npos)
        return "keyword does not exist!";

    std::size_t begin = 0;
    std::size_t end = content.size() - 1;

    // 获取前50字节 和 后100字节的迭代器位置
    if (pos > begin + prevStep)
        begin += (pos - prevStep);
    if (pos + nextStep < end)
        end = pos + nextStep;

    if (begin >= end)
        return "nothing!";

    // 获取摘要
    std::string desc;
    if (content.begin() + begin > content.begin())
        desc = "...";
    desc += content.substr(begin, end - begin);
    if (content.begin() + end < content.end())
        desc += "...";

    return desc;
}
```

## 演示 及 调试

上面已经将所有 搜索的相关接口都实现了.

下面我们通过一个简单的代码调试一下:

```cpp
#include <iostream>
#include "util.hpp"
#include "index.hpp"
#include "searcher.hpp"

const std::string& rawPath = "./data/output/raw";

int main() {
	ns_searcher::searcher searcher;
	searcher.initSearcher(rawPath);

	std::string query;
	std::string json_string;

	char buffer[1024];
	while (true) {
		std::cout << "Please Enter You Search Query# ";
		fgets(buffer, sizeof(buffer) - 1, stdin);
		buffer[strlen(buffer) - 1] = 0;
		query = buffer;
		searcher.search(query, &json_string);
		std::cout << json_string << std::endl;
	}

	return 0;
}
```

这段代码可以把搜索到的内容 直接打印出来.

我们演示一下:

首先是 建立索引的过程:

![](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/202308211619351.gif)

然后就是搜索

![](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/202308211619112.gif)

从大体的结果上来看, 是没什么问题的. 不仅可以搜索到, 而且是按照`weight`排序的

但是, 为什么`desc`会是`keyword does not exist!`? 

![](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/202308061931396.webp)

搜到了文档, 应该就表示文档中有这个关键词. 但为什么会出现`keyword does not exist!`?

其实原因很简单: 我们通过关键词 在倒排索引中搜索, 都是通过全小写来搜索的. 所以可以 搜到文档. 但是`getDesc()`获取摘要的接口, 可并没有实现通过小写来查询关键字. 这时候, 就有可能找不到全小写的关键字, 也就无法获取摘要.

所以, `getDesc()`接口 在正文内容中查找关键字的行为, 不能简单的使用`string::find()`. 

### `getDesc()`接口 优化

不能使用`string::find()`, 并且 `string`也并没有提供忽略大小写搜索的接口

而且, 关键词可以改为小写, 但是也不能将正文内容全部转换成小写呀.

那么, 在正文中如何忽略大小写的查找关键词呢? 

`std::search()`接口. 可以通过仿函数来设置字符之间的查找方式:

```cpp
std::string getDesc(const std::string& content, const std::string& keyword) {
    // 如何获取摘要呢?
    // 我们尝试获取正文中 第一个keyword 的前50个字节和后100个字节的内容 作为摘要
    const std::size_t prevStep = 50;
    const std::size_t nextStep = 100;
    // 获取正文中 第一个 keyword 的位置

    // std::size_t pos = content.find(keyword);
    // if (pos == std::string::npos)
    //     return "keyword does not exist!";
    // 直接这样处理, 会出现一个问题:
    // keyword是有大小写的. 倒排索引中查找 我们实现的是忽略大小写, 所以可以找到文档
    // 而 string::find() 是区分大小写的查找, 可能无法在内容中找到对应的关键词
    // string容器也没有提供不区分大小写的查找方法
    // 此时, 可以用std::search()
    // std::search(it1, it2, it3, it4, pred);
    // 可以在[it1, it2)中 查找第一个[it3, it4)(词语)的出现位置.
    // 并且, 如果使用第5个参数, 就可以传入 带有两个参数的仿函数, 这两个参数就是需要比较的字符
    // 可以在仿函数内设置这两个字符的比较方式
    // 最终会返回找到的找到的单次第一个字符位置的迭代器, 否则返回it2
    auto iter = std::search(content.begin(), content.end(), keyword.begin(), keyword.end(),
                            [](int x, int y) {
                                return std::tolower(x) == std::tolower(y);
                            });
    if (iter == content.end())
        return "keyword does not exist!";
    std::size_t pos = std::distance(content.begin(), iter);

    std::size_t begin = 0;
    std::size_t end = content.size() - 1;

    // 获取前50字节 和 后100字节的迭代器位置
    if (pos > begin + prevStep)
        begin += (pos - prevStep);
    if (pos + nextStep < end)
        end = pos + nextStep;

    if (begin >= end)
        return "nothing!";

    // 获取摘要
    std::string desc;
    if (content.begin() + begin > content.begin())
        desc = "...";
    desc += content.substr(begin, end - begin);
    if (content.begin() + end < content.end())
        desc += "...";

    return desc;
}
```

使用`std::search(it1, it2, it3, it4, pred);`

可以在`[it1, it2)`中 查找第一个`[it3, it4)(词语)`的出现位置.

并且, 如果使用第5个参数, 就可以传入**带有两个参数的仿函数, 这两个参数就是需要比较的字符**可以在仿函数内设置这**两个字符的比较方式**

最终会返回找到的找到的单次第一个字符位置的迭代器, 否则返回`it2`

在仿函数内, 将参数字符都以小写的形式比较, 就可以实现忽略大小写比较:

![](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/202308211619259.gif)

这次, 就可以在文档中找到关键词了.

---

代码实现到这里, 本地搜索的接口 其实已经相对完善了.

但是 还并没有结束

## 停用词的处理 *

在项目中, 我们使用`jieba`库针对搜索内容和文档内容来分词, 分别用来搜索和建立索引.

但是, 分词时很可能会分出一些非常常见的词, 比如中文的: `了` `在` `的` `它` `他` `她` `你`… 还有英文的: `a` `an` `the` `you` `it` `that` `this` …  还有一些标点符号. 这部分词 被称为**停用词**或**停止词**或**暂停词**

这些词, 实际对 这种文档的搜索是没有什么用的. 而我们在分词的时候 并没有去除这些字, 这会导致什么结果呢?

![](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/202308211619370.gif)

搜索`the` ` ` `a` `an`都能搜出文档, 但是我们输入的并不是具有目的的有效内容. 空格都能搜出文档.

而, 我们的目的是 防止用户通过停用词查找到了一些无关的文档. 

所以, 我们可以将这些**停用词**在分词之后, 去除掉.

怎么去除呢? `jieba`分词库, 已经提供了 统计了常见的停用词的文件: 

![](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/202308062024987.webp)

内容是这样一行一行的:

![](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/202308062025609.webp)

我们只需要将文件的内容按行以`string`的类型 读取到内存中, 然后在分词之后 遍历分词 进行查找去除, 就可以实现去除分词中的停用词.

> `jieba`提供的停用词有些不适合被过滤掉, 有兴趣可以自己整理一下
>
> 比如 `about`, 毕竟`Boost`库文档中的第一个文档名就是`about`. 如果被当作停用词去掉了, 是不是有点不合适?
>
> 博主把 `about` `any` `move` 删除掉. 因为`data/input`目录下存在以这三个单词为名的文档:
>
> ![|wide](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/202308071701349.webp)

然后可以在`util.hpp`中的`jiebaUtil`类中添加一个去除停用词的版本. 

由于需要将停用词从文件加载到内存中, 而且只需要加载一次, 所以可以考虑将`jiebaUtil`设置为单例:

```cpp
const char* const DICT_PATH = "./cppjiebaDict/jieba.dict.utf8";
const char* const HMM_PATH = "./cppjiebaDict/hmm_model.utf8";
const char* const USER_DICT_PATH = "./cppjiebaDict/user.dict.utf8";
const char* const IDF_PATH = "./cppjiebaDict/idf.utf8";
const char* const STOP_WORD_PATH = "./cppjiebaDict/stop_words.utf8";

class jiebaUtil {
    private:
    cppjieba::Jieba _jieba;
    std::unordered_map<std::string, bool> _stopKeywordMap;

    jiebaUtil()
        : _jieba(DICT_PATH, HMM_PATH, USER_DICT_PATH, IDF_PATH, STOP_WORD_PATH) {}

    jiebaUtil(const jiebaUtil&) = delete;
    jiebaUtil& operator=(const jiebaUtil&) = delete;

    static jiebaUtil* _instance;

    private:
    // 主要是为了支持 消除停止词的分词
    // 也就是需要将停止词, 写入到 map中
    bool initJiebaUtil() {
        // 首先按行读取文件 const char* const STOP_WORD_PATH = "./cppjiebaDict/stop_words.utf8"
        std::ifstream stopFile(STOP_WORD_PATH, std::ios::in);
        if (!stopFile.is_open()) {
            return false;
        }

        std::string line;
        while (std::getline(stopFile, line)) {
            _stopKeywordMap.insert({line, true});
        }

        stopFile.close();

        return true;
    }
    
    void noStopHelper(const std::string& src, std::vector<std::string>* out) {
        _jieba.CutForSearch(src, *out);
        // 遍历out 查询是否为停止词 是则删除
        // 需要注意迭代器失效的问题
        for (auto iter = out->begin(); iter != out->end();) {
            std::string word = *iter;
            boost::to_lower(word);
            // 这里要注意, 函数的第一个参数 src 传入的一般是文档原文 或 搜索内容的原文
            // 原文内容都是区分大小写的, 也就是说这里的iter指向的分词都是有大小写之分的
            // 而jieba库提供的停用词都是小写的, 也就是说_stopKeywordMap内存储的内容都是小写的
            // 如果拿着有大小写之分的分词, 在停用词表中查找, 是查找不到的. 
            // 所以在查找之前, 要先将iter指向的分词 小写化, 然后再在停用词表中找
            auto stopIt = _stopKeywordMap.find(word);
            if (stopIt != _stopKeywordMap.end())
                // 注意接收erase的返回值 防止出现迭代器失效问题
                iter = out->erase(iter);
            else
                iter++;
        }
    }

    public:
    static jiebaUtil* getInstance() {
        static std::mutex mtx;
        if (nullptr == _instance) {
            mtx.lock();
            if (nullptr == _instance) {
                _instance = new jiebaUtil;
                _instance->initJiebaUtil(); // 初始化单例
            }
            mtx.unlock();
        }

        return _instance;
    }

    // 分词: 不消除停止词的版本
    void cutString(const std::string& src, std::vector<std::string>* out) {
        _jieba.CutForSearch(src, *out);
    }
    // 分词: 消除停止词的版本
    void cutStringNoStop(const std::string& src, std::vector<std::string>* out) {
        noStopHelper(src, out);
    }
};
jiebaUtil* jiebaUtil::_instance;
```

具体的实现思路是: 

1. 添加一个`unordered_map<string, bool>`成员对象, 用来记录停用词
2. 定义一个`initJiebaUtil()`接口, 用于初始化`jiebaUtil`类. 实际做的是 将停用词加载到`unordered_map`中的工作
3. 然后定义一个私有的`noStopHelper()`接口, 用于以消除暂停词的方式分词
4. 然后提供一个公有的`cutStringNoStop()`接口, 封装`noStopHelper()`.
5. 然后再实现线程安全的单例模式就好了

特别需要注意的一点是: **实现对分词进行去除停用词的操作时, 在对`src`分词之后 需要遍历分词并在停用词表中查找是否为停用词. 查找 此分词在停用词表中查找是否存在时, 必须要先将分词小写化. 因为停用词表中的词都是小写的, 如果拿着有大小写之分的词, 去查全小写的表, 会出现应该找到 但是却没有找到的情况.**

并且, 将`jiebaUtil`设置为单例模式. 也就意味着之前 调用分词的接口需要修改一下. 不过先不急.

先来分析几个问题:

1. 分词操作要在哪里做?

    答: 搜索的时候, 对输入的内容分词 以及 建立倒排索引的时候, 对文档的内容分词

2. 去除停用词的分词操作, 是否会消耗更长的时间、更多的资源?

    答: 肯定会的. 因为去除停用词的步骤, 说到底就是遍历分出来的词 并在`停用词的unordered_map`中查找是否有当前词. 至少是一个`O(N)`的过程

3. 搜索时 和 建立索引时, 是否都需要用到 去除停用词的分词操作?

    答案是, **不需要**都使用去除停用词的分词操作

    这两方, **只要有一方去除了停用词**. 那么在搜索时, **就不会根据停用词去搜索文档**. 那么也就分了两种情况:

    1. 搜索时 去除了停用词, 建立索引时 没有去除停用词

        那么, 就只会使用 有效词 搜索, 索引中是否存在停用词的相关索引 也就没有关系

    2. 搜索时 没有去除停用词, 建立索引时 去除了停用词

        那么, 索引中就不会存在停用词的相关索引, 就算使用 停用词 去搜索, 也不会根据停用词搜索到文档.

    这两种情况, 有很大的区别. 我们知道, 去除停用词是需要消耗资源的. 分词越多, 用的时间就越久, 那么对于建立索引时的去除停用词操作来说, 那将会是一个非常耗时的工程. 

    每一篇文档内容 都可能分出上千 甚至上万的词. 如果对每篇文档的分词在进行去除停用词的操作. 那将会非常的耗时.

    那么:

    1. 对于第一种情况. 搜索时 输入的内容绝大情况下是比文档内容少的. 虽然也会有一定的消耗, 但是没有建立索引时消耗的大

        如果只在搜索时, 对搜索分词进行去除停用词. 而建立索引时不去除停用词

        那么, 如果从全局的角度来看, 服务器就没有非常巨大的消耗

    2. 而对于第二种情况. 

        如果在建立索引时, 对每篇文章的内容分词去除停用词. 就是一个非常耗时的工程.

        从全局的角度来看, 服务器会存在一段非常巨大的消耗

    所以, 我们应该选第2种情况吗?

    并不是的. 

    **从用户的效率来讲, 最好选用第一种情况**, 为什么? 

    因为我们的搜索引擎 是给用户提供服务的, 搜索的速度用户可以感知到. 如果在搜索时 进行去除停用词的操作. 某些情况下, 可能会在一定程度上影响搜索的效率

    而 索引的建立, 是实现在服务器正式启动之前的. 这一部分的开销再大, 用户也是感知不到的. 

    所以, 我们这里选择第1种实现.

    > 当然, 情况的选择不绝对. 因为网络上数据的传输情况非常的复杂. 可能传输的数据量也会很大程度上影响效率
    >
    > 就像一般的搜索引擎都会限制输入长度.

所以, `ns_index::index` 和 `ns_searcher::searcher`两个类中, 关于分词的实现 就需要变化一下:

### **`ns_index::index::buildInvertedIndex()`**

```cpp
// 关于分词 使用 cppjieba 中文分词库
bool buildInvertedIndex(const docInfo_t& doc) {
    // 用来映射关键字 和 关键字的词频
    std::unordered_map<std::string, keywordCnt_t> keywordsMap;
    ns_util::jiebaUtil* jiebaIns = ns_util::jiebaUtil::getInstance();
    
    // 标题分词
    std::vector<std::string> titleKeywords;
    jiebaIns->cutStringNoStop(doc._title, &titleKeywords); // 去除停用词分词
    // ns_util::jiebaUtil::cutString(doc._title, &titleKeywords);
    // 标题词频统计 与 转换 记录
    for (auto keyword : titleKeywords) {
        boost::to_lower(keyword);		  // 关键字转小写
        keywordsMap[keyword]._titleCnt++; // 记录关键字 并统计标题中词频
        // unordered_map 的 [], 是用来通过keyword值 访问value的. 如果keyword值已经存在, 则返回对应的value, 如果keyword值不存在, 则会插入keyword并创建对应的value
    }

    // 内容分词
    std::vector<std::string> contentKeywords;
    jiebaIns->cutStringNoStop(doc._content, &contentKeywords); // 去除停用词分词
    // ns_util::jiebaUtil::cutString(doc._content, &contentKeywords);
    // 内容词频统计 与 转换 记录
    for (auto keyword : contentKeywords) {
        boost::to_lower(keyword);			// 关键字转小写
        keywordsMap[keyword]._contentCnt++; // 记录关键字 并统计内容中词频
    }

    // 这两个const 变量是用来计算 关键字在文档中的权重的.
    // 并且, 关键字出现在标题中  文档与关键字的相关性大概率是要高的, 所以 可以把titleWeight 设置的大一些
    const int titleWeight = 40;
    const int contentWeight = 1;
    // 分词并统计词频之后, keywordsMap 中已经存储的当前文档的所有关键字, 以及对应的在标题 和 内容中 出现的频率
    // 就可以遍历 keywordsMap 获取关键字信息, 构建 invertedElem 并添加到 invertedIndex中 关键词的倒排拉链 invertedList中了
    for (auto& keywordInfo : keywordsMap) {
        invertedElem_t item;
        item._docId = doc._docId;		   // 本文档id
        item._keyword = keywordInfo.first; // 关键字
        item._weight = keywordInfo.second._titleCnt * titleWeight + keywordInfo.second._contentCnt * contentWeight;

        // 上面构建好了 invertedElem, 下面就要将 invertedElem 添加到对应关键字的 倒排拉链中, 构建倒排索引
        invertedList_t& list = invertedIndex[keywordInfo.first]; // 获取关键字对应的倒排拉链
        list.push_back(std::move(item));
    }

    return true;
}
```

### **`ns_searcher::searcher::search()`**

```cpp
void search(const std::string& query, std::string* jsonString) {
    // 1. 对需要搜索的句子或关键词进行分词
    std::vector<std::string> keywords;
    ns_util::jiebaUtil* jiebaIns = ns_util::jiebaUtil::getInstance();

    jiebaIns->cutString(query, &keywords); // 不去除停用词分词
    // ns_util::jiebaUtil::cutString(query, &keywords);
    
    // 统计文档用, 因为可能存在不同的分词 在倒排索引中指向同一个文档的情况
    // 如果不去重, 会重复展示
    std::unordered_map<std::size_t, invertedElemOut_t> invertedElemOutMap;
    // 2. 根据分词获取倒排索引中的倒排拉链, 并汇总去重 invertedElem
    for (std::string word : keywords) {
        boost::to_lower(word);

        ns_index::invertedList_t* tmpInvertedList = _index->getInvertedList(word);
        if (nullptr == tmpInvertedList) {
            // 没有这个关键词
            continue;
        }

        for (auto& elem : *tmpInvertedList) {
            // 遍历倒排拉链, 根据文档id 对invertedElem 去重
            auto& item = invertedElemOutMap[elem._docId]; // 在map中获取 或 创建对应文档id的 invertedElem
            item._docId = elem._docId;
            item._weight += elem._weight;
            item._keywords.push_back(elem._keyword);
            // 此时就将当前invertedElem 去重到了 invertedElemMap 中
        }
    }

    // vector 存储 文档相关信息, 方便排序
    std::vector<invertedElemOut_t> allInvertedElemOut;
    // 出循环之后, 就将搜索到的 文档的 id、权重和相关关键词 存储到了 invertedElemMap
    // 然后将文档的相关信息 invertedElemOut 都存储到 vector 中
    for (const auto& elemOut : invertedElemOutMap) {
        // map中的second: elemOut, 在执行此操作之后, 就没用了
        // 所以使用移动语义, 防止发生拷贝
        allInvertedElemOut.push_back(std::move(elemOut.second));
    }

    std::sort(allInvertedElemOut.begin(), allInvertedElemOut.end(),
              [](const invertedElemOut_t& elem1, const invertedElemOut_t& elem2) {
                  return elem1._weight > elem2._weight;
              });

    // 然后 通过遍历此数组, 获取文档id, 根据id获取文档在正排索引中的内容
    // 然后再将 所有内容序列化
    Json::Value root;
    for (auto& elemOut : allInvertedElemOut) {
        // 通过Json::Value 对象, 存储文档内容
        Json::Value elem;
        // 通过elemOut._docId 获取正排索引中 文档的内容信息
        ns_index::docInfo_t* doc = _index->getForwardIndex(elemOut._docId);
        // elem赋值
        elem["url"] = doc->_url;
        elem["title"] = doc->_title;
        // 关于文档的内容, 搜索结果中是不展示文档的全部内容的, 应该只显示包含关键词的摘要, 点进文档才显示相关内容
        // 而docInfo中存储的是文档去除标签之后的所有内容, 所以不能直接将 doc._content 存储到elem对应key:value中
        elem["desc"] = getDesc(doc->_content, elemOut._keywords[0]); // 只根据第一个关键词来获取摘要
        // for Debug
        // 这里有一个bug, jsoncpp 0.10.5.2 是不支持long或long long 相关类型的, 所以需要转换成 double
        // 这里转换成 double不会有什么影响, 因为这两个参数只是本地调试显示用的.
        elem["docId"] = (double)doc->_docId;
        elem["weight"] = (double)elemOut._weight;

        root.append(elem);
    }

    // 序列化完成之后将相关内容写入字符串
    // for Debug 用 styledWriter
    Json::StyledWriter writer;
    *jsonString = writer.write(root);
}
```

### 结果演示

我们选择的这种方式, **会将建立索引的时长拉的很长**, 最起码比之前要长的多:

![](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/202308211619658.gif)

然后就可以进行搜索了:

![](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/202308211620366.gif)

---

# 项目当前 目录结构

`Boost`文档搜索引擎库这个项目, 当前已经实现了:

1. `parser`文档内容处理模块
2. `index`索引建立相关接口
3. `searcher`搜索实现相关接口

当前项目目录结构为:

```bash
❯ pwd
/home/July/gitCode/gitHub/Boost-Doc-Searcher
❯ tree -L 3
.
├── cppjieba
│   ├── DictTrie.hpp
│   ├── ...(jieba库相关头文件)
│   └── Unicode.hpp
├── cppjiebaDict
│   ├── hmm_model.utf8
│   ├── ...(jieba库提供的分词库)
│   └── user.dict.utf8
├── data
│   ├── input
│   │   ├── about.html
│   │   ├── ...(Boost库文档文件)
│   │   └── yap.html
│   └── output
│       └── raw
├── index.hpp
├── LICENSE
├── makefile
├── parser.cc
├── README.md
├── searcher.hpp
├── serverDebug.cc
└── util.hpp

63 directories, 279 files
```

# 索引接口 以及 搜索接口 相关代码整合

当前, `util.hpp` `index.hpp` 和 `searcher.hpp` 的代码:

## **`util.hpp`:**

```cpp
// util.hpp 一般定义一些通用的宏定义、工具函数等

#pragma once

#include <boost/algorithm/string/case_conv.hpp>
#include <iostream>
#include <unordered_map>
#include <vector>
#include <string>
#include <fstream>
#include <mutex>
#include <boost/algorithm/string.hpp>
#include "cppjieba/Jieba.hpp"

namespace ns_util {
    class fileUtil {
    public:
        // readFile 用于读取指定文本文件的内容, 到string输出型参数中
        static bool readFile(const std::string& filePath, std::string* out) {
            // 要读取文件内容, 就要先打开文件
            // 1. 以读取模式打开文件
            std::ifstream in(filePath, std::ios::in);
            if (!in.is_open()) {
                // 打卡文件失败
                std::cerr << "Failed to open " << filePath << "!" << std::endl;
                return false;
            }

            // 走到这里打开文件成功
            // 2. 读取文件内, 并存储到out中
            std::string line;
            while (std::getline(in, line)) {
                *out += line;
            }

            in.close();

            return true;
        }
    };

    class stringUtil {
    public:
        static bool split(const std::string& file, std::vector<std::string>* fileResult, const std::string& sep) {
            // 使用 boost库中的split接口, 可以将 string 以指定的分割符分割, 并存储到vector<string>输出型参数中
            boost::split(*fileResult, file, boost::is_any_of(sep), boost::algorithm::token_compress_on);
            // boost::algorithm::token_compress_on 表示压缩连续的分割符

            if (fileResult->empty()) {
                return false;
            }

            return true;
        }
    };

    const char* const DICT_PATH = "./cppjiebaDict/jieba.dict.utf8";
    const char* const HMM_PATH = "./cppjiebaDict/hmm_model.utf8";
    const char* const USER_DICT_PATH = "./cppjiebaDict/user.dict.utf8";
    const char* const IDF_PATH = "./cppjiebaDict/idf.utf8";
    const char* const STOP_WORD_PATH = "./cppjiebaDict/stop_words.utf8";

    class jiebaUtil {
    private:
        cppjieba::Jieba _jieba;
        std::unordered_map<std::string, bool> _stopKeywordMap;

        jiebaUtil()
            : _jieba(DICT_PATH, HMM_PATH, USER_DICT_PATH, IDF_PATH, STOP_WORD_PATH) {}

        jiebaUtil(const jiebaUtil&) = delete;
        jiebaUtil& operator=(const jiebaUtil&) = delete;

        static jiebaUtil* _instance;

    private:
        void noStopHelper(const std::string& src, std::vector<std::string>* out) {
            _jieba.CutForSearch(src, *out);
            // 遍历out 查询是否为停止词 是则删除
            // 需要注意迭代器失效的问题
            for (auto iter = out->begin(); iter != out->end();) {
                std::string word = *iter;
                boost::to_lower(word);
                auto stopIt = _stopKeywordMap.find(word);
                // auto stopIt = _stopKeywordMap.find(*iter);
                if (stopIt != _stopKeywordMap.end()) {
                    // 注意接收erase的返回值 防止出现迭代器失效问题
                    iter = out->erase(iter);
                }
                else {
                    iter++;
                }
            }
        }

        // 主要是为了支持 消除停止词的分词
        // 也就是需要将停止词, 写入到 map中
        bool initJiebaUtil() {
            // 首先按行读取文件 const char* const STOP_WORD_PATH = "./cppjiebaDict/stop_words.utf8"
            std::ifstream stopFile(STOP_WORD_PATH, std::ios::in);
            if (!stopFile.is_open()) {
                return false;
            }

            std::string line;
            while (std::getline(stopFile, line)) {
                _stopKeywordMap.insert({line, true});
            }

            stopFile.close();

            return true;
        }

    public:
        static jiebaUtil* getInstance() {
            static std::mutex mtx;
            if (nullptr == _instance) {
                mtx.lock();
                if (nullptr == _instance) {
                    _instance = new jiebaUtil;
                    _instance->initJiebaUtil();
                }
                mtx.unlock();
            }

            return _instance;
        }

        // 分词: 不消除停止词的版本
        void cutString(const std::string& src, std::vector<std::string>* out) {
            _jieba.CutForSearch(src, *out);
        }
        // 分词: 消除停止词的版本
        void cutStringNoStop(const std::string& src, std::vector<std::string>* out) {
            noStopHelper(src, out);
        }
    };
    jiebaUtil* jiebaUtil::_instance;
    // cppjieba::Jieba jiebaUtil::jieba(DICT_PATH, HMM_PATH, USER_DICT_PATH, IDF_PATH, STOP_WORD_PATH);
}
```

## **`index.hpp`:**

```cpp
// 本代码是 建立索引相关的接口
// 索引 是用来快速搜索的
// parser模块, 已经将所有文档内容处理好, 并存储到了 data/output/raw 中
// 索引的建立, 就是通过获取 已经处理好的文档内容 来建立的
// 项目中, 需要分别建立正排索引和倒排索引
// 正排索引, 是从文档id 找到文件内容的索引
// 倒排索引, 是从关键词 找到关键词所在文档id 的索引

// 首先第一个问题:
// 正排索引中 文件内容该如何表示?
// 其实在parser模块中, 已经有过相关的处理了, 即用结构体(docInfo) 成员为: title、content、url
// 不过, 在建立索引时, 文档在索引中 应该存在一个文档id.

// 正排索引结构
// 正排索引 可以通过文档id找到文件内容. 那么 正排索引可以用 vector 建立, vector 存储docInfo结构体 那么数组下标就天然是 文档id

// 倒排索引结构
// 倒排索引 需要通过关键字 找到包含关键字的文档id, 文档id 对应正排索引中的下标, 所以需要先建立正排索引, 再建立倒排索引
// 由于可能多个文档包含相同的关键字, 倒排索引更适合 keyword:value 结构存储. 所以 可以使用 unordered_map
// 并且, 同样因为关键字可能找到多个文档, value的类型就 可以是存储着文档id的vector, 称为倒排拉链

// 倒排索引中, 通过关键字找到的 倒排拉链中 不应该仅仅是文档id的数据.
// 因为倒排索引的查找结果是关乎到查找结果的显示顺序的. 所以 还需要知道对应文档id 在本次搜索的权重.
// 所以, 最好将文档id和权重结合起来, 构成一个结构体(invertedElem)存储.
// 不过, 不需要 先将所有文档的正排索引建立完成之后 再建立倒排索引. 可以先给 某文档建立正排索引之后, 直接对此文档建立倒排索引

#pragma once

#include <iostream>
#include <fstream>
#include <utility>
#include <vector>
#include <string>
#include <unordered_map>
#include <mutex>
#include "util.hpp"

namespace ns_index {

    // 用于正排索引中 存储文档内容
    typedef struct docInfo {
        std::string _title;   // 文档标题
        std::string _content; // 文档去标签之后的内容
        std::string _url;     // 文档对应官网url
        std::size_t _docId;   // 文档id
    } docInfo_t;

    // 用于倒排索引中 记录关键字对应的文档id和权重
    typedef struct invertedElem {
        std::size_t _docId;    // 文档id
        std::string _keyword;  // 关键字
        std::uint64_t _weight; // 搜索此关键字, 此文档id 所占权重

        invertedElem() // 权重初始化为0
            : _weight(0) {}
    } invertedElem_t;

    // 关键字的词频
    typedef struct keywordCnt {
        std::size_t _titleCnt;   // 关键字在标题中出现的次数
        std::size_t _contentCnt; // 关键字在内容中出现的次数

        keywordCnt()
            : _titleCnt(0)
            , _contentCnt(0) {}
    } keywordCnt_t;

    // 倒排拉链
    typedef std::vector<invertedElem_t> invertedList_t;

    class index {
    private:
        // 正排索引使用vector, 下标天然是 文档id
        std::vector<docInfo_t> forwardIndex;
        // 倒排索引 使用 哈希表, 因为倒排索引 一定是 一个keyword 对应一组 invertedElem拉链
        std::unordered_map<std::string, invertedList_t> invertedIndex;

        // 单例模式设计
        index() {}

        index(const index&) = delete;
        index& operator=(const index&) = delete;

        static index* _instance; // 单例
        static std::mutex _mtx;

    public:
        // 获取单例
        static index* getInstance() {
            if (nullptr == _instance) {
                _mtx.lock();
                if (nullptr == _instance) {
                    _instance = new index;
                }
                _mtx.unlock();
            }

            return _instance;
        }

        // 通过关键字 检索倒排索引, 获取对应的 倒排拉链
        invertedList_t* getInvertedList(const std::string& keyword) {
            // 先找 关键字 所在迭代器
            auto iter = invertedIndex.find(keyword);
            if (iter == invertedIndex.end()) {
                std::cerr << keyword << " have no invertedList!" << std::endl;
                return nullptr;
            }

            // 找到之后
            return &(iter->second);
        }

        // 通过倒排拉链中 每个倒排元素中存储的 文档id, 检索正排索引, 获取对应文档内容
        docInfo_t* getForwardIndex(std::size_t docId) {
            if (docId >= forwardIndex.size()) {
                std::cerr << "docId out range, error!" << std::endl;
                return nullptr;
            }

            return &forwardIndex[docId];
        }

        // 根据parser模块处理过的 所有文档的信息
        // 提取文档信息, 建立 正排索引和倒排索引
        // input 为 ./data/output/raw
        bool buildIndex(const std::string& input) {
            // 先以读取方式打开文件
            std::ifstream in(input, std::ios::in);
            if (!in.is_open()) {
                std::cerr << "Failed to open " << input << std::endl;
                return false;
            }

            std::size_t count = 0;

            std::string line;
            while (std::getline(in, line)) {
                // 按照parser模块的处理, getline 一次读取到的数据, 就是一个文档的: title\3content\3url\n
                docInfo_t* doc = buildForwardIndex(line); // 将一个文档的数据 建立到索引中
                if (nullptr == doc) {
                    std::cerr << "Failed to buildForwardIndex for " << line << std::endl;
                    continue;
                }

                // 文档建立正排索引成功, 接着就通过 doc 建立倒排索引
                if (!buildInvertedIndex(*doc)) {
                    std::cerr << "Failed to buildInvertedIndex for " << line << std::endl;
                    continue;
                }

                count++;
                if (count % 50 == 0)
                    std::cout << "当前已经建立的索引文档: " << count << std::endl;
            }

            return true;
        }

    private:
        // 对一个文档建立正排索引
        docInfo_t* buildForwardIndex(const std::string& file) {
            // 一个文档的 正排索引的建立, 是将 title\3content\3url (file) 中title content url 提取出来
            // 构成一个 docInfo_t doc
            // 然后将 doc 存储到正排索引vector中
            std::vector<std::string> fileResult;
            const std::string sep("\3");
            // stringUtil::split() 字符串通用工具接口, 分割字符串
            ns_util::stringUtil::split(file, &fileResult, sep);

            docInfo_t doc;
            doc._title = fileResult[0];
            doc._content = fileResult[1];
            doc._url = fileResult[2];

            // 因为doc是需要存储到 forwardIndex中的, 存储之前 forwardIndex的size 就是存储之后 doc所在的位置
            doc._docId = forwardIndex.size();

            forwardIndex.push_back(std::move(doc));

            return &forwardIndex.back();
        }

        // 对一个文档建立倒排索引
        // 倒排索引是用来通过关键词定位文档的.
        // 倒排索引的结构是 std::unordered_map<std::string, invertedList_t> invertedIndex;
        // keyword值就是关键字, value值则是关键字所映射到的文档的倒排拉链
        // 对一个文档建立倒排索引的原理是:
        //  1. 首先对文档的标题 和 内容进行分词, 并记录分词
        //  2. 分别统计整理标题分析的词频 和 内容分词的词频
        //     统计词频是为了可以大概表示关键字在文档中的 相关性.
        //     在本项目中, 可以简单的认为关键词在文档中出现的频率, 代表了此文档内容与关键词的相关性. 当然这是非常肤浅的联系, 一般来说相关性的判断都是非常复杂的. 因为涉及到词义 语义等相关分析.
        //     每个关键字 在标题中出现的频率 和 在内容中出现的频率, 可以记录在一个结构体中. 此结构体就表示关键字的词频
        //  3. 使用 unordered_map<std::string, wordCnt_t> 记录关键字与其词频
        //  4. 通过遍历记录关键字与词频的 unordered_map, 构建 invertedElem: _docId, _keyword, _weight
        //  5. 构建了关键字的invertedElem 之后, 再将关键词的invertedElem 添加到在 invertedIndex中 关键词的倒排拉链 invertedList中
        // 注意, 搜索引擎一般不区分大小写, 所以可以将分词出来的所有的关键字, 在倒排索引中均以小写的形式映射. 在搜索时 同样将搜索请求分词出的关键字小 写化, 在进行检索. 就可以实现搜索不区分大小写.

        // 关于分词 使用 cppjieba 中文分词库
        bool buildInvertedIndex(const docInfo_t& doc) {
            // 用来映射关键字 和 关键字的词频
            std::unordered_map<std::string, keywordCnt_t> keywordsMap;
            ns_util::jiebaUtil* jiebaIns = ns_util::jiebaUtil::getInstance();

            // 标题分词
            std::vector<std::string> titleKeywords;
            jiebaIns->cutStringNoStop(doc._title, &titleKeywords);
            // jiebaIns->cutString(doc._title, &titleKeywords);
            // 标题词频统计 与 转换 记录
            for (auto keyword : titleKeywords) {
                boost::to_lower(keyword);         // 关键字转小写
                keywordsMap[keyword]._titleCnt++; // 记录关键字 并统计标题中词频
                                                  // unordered_map 的 [], 是用来通过keyword值 访问value的. 如果keyword值已经存在, 则返回对应的value, 如果keyword值不存在, 则会插入keyword并创建对应的value
            }

            // 内容分词
            std::vector<std::string> contentKeywords;
            jiebaIns->cutStringNoStop(doc._content, &contentKeywords);
            // jiebaIns->cutString(doc._content, &contentKeywords);
            // 内容词频统计 与 转换 记录
            for (auto keyword : contentKeywords) {
                boost::to_lower(keyword);           // 关键字转小写
                keywordsMap[keyword]._contentCnt++; // 记录关键字 并统计内容中词频
            }

            // 这两个const 变量是用来计算 关键字在文档中的权重的.
            // 并且, 关键字出现在标题中  文档与关键字的相关性大概率是要高的, 所以 可以把titleWeight 设置的大一些
            const int titleWeight = 40;
            const int contentWeight = 1;
            // 分词并统计词频之后, keywordsMap 中已经存储的当前文档的所有关键字, 以及对应的在标题 和 内容中 出现的频率
            // 就可以遍历 keywordsMap 获取关键字信息, 构建 invertedElem 并添加到 invertedIndex中 关键词的倒排拉链 invertedList中了
            for (auto& keywordInfo : keywordsMap) {
                invertedElem_t item;
                item._docId = doc._docId;          // 本文档id
                item._keyword = keywordInfo.first; // 关键字
                item._weight = keywordInfo.second._titleCnt * titleWeight + keywordInfo.second._contentCnt * contentWeight;

                // 上面构建好了 invertedElem, 下面就要将 invertedElem 添加到对应关键字的 倒排拉链中, 构建倒排索引
                invertedList_t& list = invertedIndex[keywordInfo.first]; // 获取关键字对应的倒排拉链
                list.push_back(std::move(item));
            }

            return true;
        }
    };
    // 单例相关
    index* index::_instance = nullptr;
    std::mutex index::_mtx;
}
```

## **`searcher.hpp`:**

```cpp
// 本文件实现 搜索相关接口

// 本项目中的搜索, 是根据输入的关键词:
//  1. 先对关键词进行分词
//  2. 然后通过分词, 在倒排索引中进行检索, 检索到相关的倒排拉链
//  3. 然后再通过倒排拉链中 倒排元素的对应文档id, 在正排索引中获取文件内容

// 不过在正式开始搜索之前, 要先构建索引
// 而索引的构建, 在整个程序中只需要构建一次, 所以可以将索引设计为单例模式
#pragma once

#include <algorithm>
#include <cctype>
#include <iostream>
#include <iterator>
#include <string>
#include <vector>
#include <unordered_map>
#include <algorithm>
#include <boost/algorithm/string.hpp>
#include <jsoncpp/json/json.h>
#include "util.hpp"
#include "index.hpp"

namespace ns_searcher {
    typedef struct invertedElemOut {
        std::size_t _docId;
        std::uint64_t _weight;
        std::vector<std::string> _keywords;
    } invertedElemOut_t;

    class searcher {
    private:
        ns_index::index* _index; // 建立索引的类

        ns_util::jiebaUtil* _jiebaIns;

    public:
        void initSearcher(const std::string& input) {
            // 搜索前的初始化操作
            // 获取单例
            _index = ns_index::index::getInstance();
            _jiebaIns = ns_util::jiebaUtil::getInstance();

            std::cout << "获取单例成功 ..." << std::endl;
            // 建立索引
            _index->buildIndex(input);
            std::cout << "构建正排索引、倒排索引成功 ..." << std::endl;
        }

        // 搜索接口
        // 搜索需要实现什么功能?
        // 首先参数部分需要怎么实现?
        // 参数部分, 需要接收需要搜索的句子或关键字, 还需要一个输出型参数 用于输出查找结果
        //  查找结果我们使用jsoncpp进行序列化和反序列化
        // search() 具体需要实现的功能:
        //  1. 对接收的句子或关键词进行分词
        //  2. 根据分词, 在倒排索引中查找到所有分词的倒排拉链 汇总 的 invertedElem, 并根据相关性进行排序
        //  4. 然后再遍历所有的 invertedElem, 根据 invertedElem中存储的 文档id, 在正排索引中获取到文档内容
        //  5. 然后将获取到的文档内容使用jsoncpp 进行序列化, 存储到输出型参数中
        // 直到遍历完invertedElem
        void search(const std::string& query, std::string* jsonString) {
            // 1. 对需要搜索的句子或关键词进行分词
            std::vector<std::string> keywords;

            _jiebaIns->cutString(query, &keywords);
            // _jiebaIns->cutStringNoStop(query, &keywords);
            // ns_util::jiebaUtil::cutString(query, &keywords);

            // std::vector<invertedElemOut_t> allInvertedElemOut;
            // std::vector<ns_index::invertedElem_t> allInvertedElem;

            // 统计文档用, 因为可能存在不同的分词 在倒排索引中指向同一个文档的情况
            // 如果不去重, 会重复展示
            // std::unordered_map<std::size_t, ns_index::invertedElem_t> invertedElemMap;
            std::unordered_map<std::size_t, invertedElemOut_t> invertedElemOutMap;
            // 2. 根据分词获取倒排索引中的倒排拉链, 并汇总去重 invertedElem
            for (std::string word : keywords) {
                boost::to_lower(word);

                ns_index::invertedList_t* tmpInvertedList = _index->getInvertedList(word);
                if (nullptr == tmpInvertedList) {
                    // 没有这个关键词
                    continue;
                }

                for (auto& elem : *tmpInvertedList) {
                    // 遍历倒排拉链, 根据文档id 对invertedElem 去重
                    auto& item = invertedElemOutMap[elem._docId]; // 在map中获取 或 创建对应文档id的 invertedElem
                    item._docId = elem._docId;
                    item._weight += elem._weight;
                    // 权重需要+= 是因为多个关键词指向了同一个文档 那么就说明此文档的与搜索内容的相关性更高
                    // 所以, 就可以将多个关键字关于此文档的权重相加, 表示搜索相关性高
                    // 最好还将 此文档相关的关键词 也存储起来, 因为在客户端搜索结果中, 需要对网页中有的关键字进行高亮
                    // 但是 invertedElem 的第三个成员是 单独的一个string对象, 不太合适
                    // 所以, 可以定义一个与invertedElem 相似的, 但是第三个成员是一个 vector 的类, 比如 invertedElemOut
                    item._keywords.push_back(elem._keyword);
                    // 此时就将当前invertedElem 去重到了 invertedElemMap 中
                }
            }

            // vector 存储 文档相关信息, 方便排序
            std::vector<invertedElemOut_t> allInvertedElemOut;
            // 出循环之后, 就将搜索到的 文档的 id、权重和相关关键词 存储到了 invertedElemMap
            // 然后将文档的相关信息 invertedElemOut 都存储到 vector 中
            for (const auto& elemOut : invertedElemOutMap) {
                // map中的second: elemOut, 在执行此操作之后, 就没用了
                // 所以使用移动语义, 防止发生拷贝
                allInvertedElemOut.push_back(std::move(elemOut.second));
            }

            // 执行到这里, 可以搜索到的文档id 权重 和 相关关键词的信息, 已经都在allInvertedElemOut 中了.
            // 但是, 还不能直接 根据文档id 在正排索引中检索
            // 因为, 此时如果直接进行文档内容的索引, 在找到文档内容之后, 就要直接进行序列化并输出了. 而客户端显示的时候, 反序列化出来的文档顺序, 就是显示的文档顺序
            // 但是现在找到的文档还是乱序的. 还需要将allInvertedElemOut中的相关文档, 通过_weight 进行倒序排列
            // 这样, 序列化就是按照倒序排列的, 反序列化也会如此, 显示同样如此
            std::sort(allInvertedElemOut.begin(), allInvertedElemOut.end(),
                      [](const invertedElemOut_t& elem1, const invertedElemOut_t& elem2) {
                          return elem1._weight > elem2._weight;
                      });

            // 排序之后, allInvertedElemOut 中文档的排序就是倒序了
            // 然后 通过遍历此数组, 获取文档id, 根据id获取文档在正排索引中的内容
            // 然后再将 所有内容序列化
            Json::Value root;
            for (auto& elemOut : allInvertedElemOut) {
                // 通过Json::Value 对象, 存储文档内容
                Json::Value elem;
                // 通过elemOut._docId 获取正排索引中 文档的内容信息
                ns_index::docInfo_t* doc = _index->getForwardIndex(elemOut._docId);
                // elem赋值
                elem["url"] = doc->_url;
                elem["title"] = doc->_title;
                // 关于文档的内容, 搜索结果中是不展示文档的全部内容的, 应该只显示包含关键词的摘要, 点进文档才显示相关内容
                // 而docInfo中存储的是文档去除标签之后的所有内容, 所以不能直接将 doc._content 存储到elem对应key:value中
                elem["desc"] = getDesc(doc->_content, elemOut._keywords[0]); // 只根据第一个关键词来获取摘要
                // for Debug
                // 这里有一个bug, jsoncpp 0.10.5.2 是不支持long或long long 相关类型的, 所以需要转换成 double
                // 这里转换成 double不会有什么影响, 因为这两个参数只是本地调试显示用的.
                elem["docId"] = (double)doc->_docId;
                elem["weight"] = (double)elemOut._weight;

                root.append(elem);
            }

            // 序列化完成之后将相关内容写入字符串
            // for Debug 用 styledWriter
            Json::StyledWriter writer;
            *jsonString = writer.write(root);
        }

        std::string getDesc(const std::string& content, const std::string& keyword) {
            // 如何获取摘要呢?
            // 我们尝试获取正文中 第一个keyword 的前50个字节和后100个字节的内容 作为摘要
            const std::size_t prevStep = 50;
            const std::size_t nextStep = 100;
            // 获取正文中 第一个 keyword 的位置

            // std::size_t pos = content.find(keyword);
            // if (pos == std::string::npos)
            //  return "keyword does not exist!";
            // 直接这样处理, 会出现一个问题:
            // keyword是有大小写的. 倒排索引中查找 我们实现的是忽略大小写, 所以可以找到文档
            // 而 string::find() 是区分大小写的查找, 可能无法在内容中找到对应的关键词
            // string容器也没有提供不区分大小写的查找方法
            // 此时, 可以用std::search()
            // std::search(it1, it2, it3, it4, pred);
            // 可以在[it1, it2)中 查找第一个[it3, it4)(词语)的出现位置.
            // 并且, 如果使用第5个参数, 就可以传入 带有两个参数的仿函数, 这两个参数就是需要比较的字符
            // 可以在仿函数内设置这两个字符的比较方式
            // 最终会返回找到的找到的单次第一个字符位置的迭代器, 否则返回it2

            auto iter = std::search(content.begin(), content.end(), keyword.begin(), keyword.end(),
                                    [](int x, int y) {
                                        return std::tolower(x) == std::tolower(y);
                                    });
            if (iter == content.end())
                return "keyword does not exist!";
            std::size_t pos = std::distance(content.begin(), iter);

            std::size_t begin = 0;
            std::size_t end = content.size() - 1;

            // 获取前50字节 和 后100字节的迭代器位置
            if (pos > begin + prevStep)
                begin += (pos - prevStep);
            if (pos + nextStep < end)
                end = pos + nextStep;

            if (begin >= end)
                return "nothing!";

            // 获取摘要
            std::string desc;
            if (pos <= begin + prevStep)
                desc = "...";
            desc += content.substr(begin, end - begin);
            if (pos + nextStep < end)
                desc += "...";

            return desc;
        }
    };
}
```

---

本篇文章到此结束

感谢阅读~
